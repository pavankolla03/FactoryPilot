import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import { holtForecast, toDailySeries } from '../agents/forecast';

const LOW_BUFFER = 20; // projected end below this counts as "at risk" (not yet stockout)

export interface ScenarioMaterial {
  materialId: string;
  currentQty: number;
  dailyDemand: number; // scenario daily demand (after multiplier)
  demandOverHorizon: number;
  inboundInTime: number; // inbound arriving within horizon after supplier delay
  inboundDelayed: number; // inbound that slips past the horizon due to delay
  projectedEndQty: number;
  baselineEndQty: number; // same horizon, ×1 demand, no delay
  daysToStockout: number | null; // null = no measurable demand
  risk: 'stockout' | 'at-risk' | 'ok';
  newlyAtRisk: boolean; // ok at baseline, at-risk/stockout under the scenario
}

export interface ScenarioResult {
  warehouseId: string;
  scenario: { demandMultiplier: number; horizonDays: number; supplierDelayDays: number };
  summary: {
    materials: number;
    stockouts: number;
    atRisk: number;
    baselineStockouts: number;
    newStockouts: number;
    shortfallUnits: number;
  };
  materials: ScenarioMaterial[];
  /** Set when demand is unavailable, so zero stockouts means "not modelled". */
  unavailableReason?: string;
  /** How many materials had a real demand series behind them. */
  modelledMaterials?: number;
}

type Rec = Record<string, unknown>;

/**
 * What-if Scenario Studio (Phase AA): projects the whole warehouse over a horizon
 * under a demand shock and a supplier delay, with a baseline comparison so the
 * *new* stockouts a shock creates are visible. Pure projection — zero writes.
 */
@Injectable()
export class ScenarioService {
  private readonly logger = new Logger(ScenarioService.name);

  constructor(private readonly mcp: McpService) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  async project(
    warehouseId: string,
    opts: { demandMultiplier: number; horizonDays: number; supplierDelayDays: number },
  ): Promise<ScenarioResult> {
    const demandMultiplier = Math.min(Math.max(opts.demandMultiplier || 1, 0.1), 5);
    const horizonDays = Math.min(Math.max(Math.round(opts.horizonDays || 14), 1), 90);
    const supplierDelayDays = Math.min(Math.max(Math.round(opts.supplierDelayDays || 0), 0), 60);

    const [stockRes, trendRes, poRes] = await Promise.all([
      this.mcp.callTool('listWarehouseStock', { warehouseId }, null, true).catch(() => null),
      this.mcp.callTool('getDemandTrend', { warehouseId, days: 14, byProduct: true }).catch(() => null),
      this.mcp.callTool('getPurchaseOrders', { warehouseId }, null, true).catch(() => null),
    ]);

    // On-hand per material.
    const onHand = new Map<string, number>();
    for (const s of this.records(stockRes)) {
      const mat = String(s.materialId ?? s.productId ?? '');
      if (mat) onHand.set(mat, (onHand.get(mat) ?? 0) + Number(s.quantity ?? 0));
    }

    // Baseline daily demand per material (Holt over the 14-day trend).
    const demandRecs = new Map<string, Array<{ date: string; qty: number }>>();
    for (const r of this.records(trendRes)) {
      const mat = String(r.materialId ?? r.productId ?? '');
      if (!mat) continue;
      const date = String(r.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const qty = Number(r.totalQty ?? r.outboundQty ?? r.qty ?? 0);
      const arr = demandRecs.get(mat) ?? [];
      arr.push({ date, qty });
      demandRecs.set(mat, arr);
    }
    const baseDaily = (mat: string): number => {
      const recs = demandRecs.get(mat);
      if (!recs || recs.length === 0) return 0;
      return holtForecast(toDailySeries(recs, 14), 7).dailyDemand;
    };

    // Inbound POs per material, split by whether they arrive within the horizon
    // once the supplier delay is applied.
    const today = Date.now();
    const horizonEnd = today + horizonDays * 86_400_000;
    const inboundInTime = new Map<string, number>();
    const inboundDelayed = new Map<string, number>();
    for (const po of this.records(poRes)) {
      if (String(po.status ?? '') === 'delivered') continue;
      const mat = String(po.materialId ?? po.productId ?? '');
      if (!mat) continue;
      const qty = Number(po.qty ?? 0);
      const due = Date.parse(String(po.expectedDelivery ?? ''));
      const arrives = Number.isNaN(due) ? today : due + supplierDelayDays * 86_400_000;
      if (arrives <= horizonEnd) {
        inboundInTime.set(mat, (inboundInTime.get(mat) ?? 0) + qty);
      } else {
        inboundDelayed.set(mat, (inboundDelayed.get(mat) ?? 0) + qty);
      }
    }

    const materials: ScenarioMaterial[] = [];
    for (const [mat, qty] of onHand) {
      const bDaily = baseDaily(mat);
      const sDaily = bDaily * demandMultiplier;
      const inTime = inboundInTime.get(mat) ?? 0;
      const delayed = inboundDelayed.get(mat) ?? 0;

      const demandOverHorizon = Math.round(sDaily * horizonDays);
      const projectedEndQty = Math.round(qty + inTime - demandOverHorizon);
      // Baseline: ×1 demand, no supplier delay (all open inbound counts).
      const baselineEndQty = Math.round(qty + inTime + delayed - bDaily * horizonDays);

      const daysToStockout = sDaily > 0 ? Math.floor((qty + inTime) / sDaily) : null;
      const risk = projectedEndQty < 0 ? 'stockout' : projectedEndQty < LOW_BUFFER ? 'at-risk' : 'ok';
      const baselineOk = baselineEndQty >= LOW_BUFFER;

      materials.push({
        materialId: mat,
        currentQty: qty,
        dailyDemand: Math.round(sDaily * 100) / 100,
        demandOverHorizon,
        inboundInTime: inTime,
        inboundDelayed: delayed,
        projectedEndQty,
        baselineEndQty,
        daysToStockout,
        risk,
        newlyAtRisk: baselineOk && risk !== 'ok',
      });
    }

    materials.sort((a, b) => a.projectedEndQty - b.projectedEndQty);

    const stockouts = materials.filter((m) => m.risk === 'stockout').length;
    const atRisk = materials.filter((m) => m.risk === 'at-risk').length;
    const baselineStockouts = materials.filter((m) => m.baselineEndQty < 0).length;
    const shortfallUnits = materials.reduce((s, m) => s + (m.projectedEndQty < 0 ? -m.projectedEndQty : 0), 0);

    // A demand scenario with no demand is not a safe scenario, it is no
    // scenario. Plant 1710 returned 327 materials at dailyDemand 0 and a summary
    // of "0 stockouts, 0 new stockouts, 0 shortfall" — indistinguishable from a
    // modelled all-clear. Demand needs consumption history, which the connected
    // SAP movement feed cannot provide (no posting date).
    const modelled = materials.filter((m) => m.dailyDemand > 0).length;
    const demandUnavailable = materials.length > 0 && modelled === 0;

    return {
      warehouseId,
      scenario: { demandMultiplier, horizonDays, supplierDelayDays },
      summary: {
        materials: materials.length,
        stockouts,
        atRisk,
        baselineStockouts,
        newStockouts: Math.max(0, stockouts - baselineStockouts),
        shortfallUnits,
      },
      ...(demandUnavailable
        ? {
            unavailableReason:
              `No consumption history exists for plant ${warehouseId}, so daily demand is zero for every ` +
              'material and nothing was actually simulated. The zero stockout/shortfall figures mean ' +
              '"not modelled", NOT "safe". Connecting a movement feed with PostingDate would enable this.',
            modelledMaterials: 0,
          }
        : { modelledMaterials: modelled }),
      materials,
    };
  }
}
