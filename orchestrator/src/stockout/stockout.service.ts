import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { McpService } from '../mcp/mcp.service';
import { DbService } from '../common/db.service';
import { RedisService } from '../common/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { holtForecast, reorderPoint, toDailySeries } from '../agents/forecast';
import type { AuthUser } from '../common/types';
import { LandscapeService } from '../live/landscape.service';

const DEFAULT_LEAD_DAYS = 10;
const HORIZON_DAYS = 30; // only surface risks within this window

export interface StockoutRisk {
  warehouseId: string;
  materialId: string;
  onHand: number;
  dailyDemand: number;
  daysToStockout: number;
  inboundQty: number;
  inboundEtaDays: number | null;
  covered: boolean; // inbound arrives before stockout
  supplier: string | null;
  leadTimeDays: number;
  recommendedOrderQty: number;
  severity: 'critical' | 'high' | 'watch';
}

type Rec = Record<string, unknown>;

/**
 * Predictive Stockout Radar (Phase AB): always-on, forecast-driven days-to-stockout
 * per material, lead-time-aware severity, and covered-by-inbound detection. A
 * scheduled scan proactively notifies scoped users of newly-critical, uncovered risks.
 */
@Injectable()
export class StockoutService {
  private readonly logger = new Logger(StockoutService.name);

  constructor(
    private readonly mcp: McpService,
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeGateway,
    private readonly landscape: LandscapeService,
  ) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  private async scopedWarehouses(user: AuthUser): Promise<string[]> {
    return this.landscape.scopedWarehouseIds(user);
  }

  /** Compute the risk list for a single warehouse. */
  private async warehouseRisks(warehouseId: string): Promise<StockoutRisk[]> {
    const [stockRes, trendRes, poRes, supRes] = await Promise.all([
      this.mcp.callTool('listWarehouseStock', { warehouseId }, null, true).catch(() => null),
      this.mcp.callTool('getDemandTrend', { warehouseId, days: 14, byProduct: true }).catch(() => null),
      this.mcp.callTool('getPurchaseOrders', { warehouseId }, null, true).catch(() => null),
      this.mcp.callTool('getSuppliers', {}).catch(() => null),
    ]);

    const onHand = new Map<string, number>();
    for (const s of this.records(stockRes)) {
      const mat = String(s.materialId ?? s.productId ?? '');
      if (mat) onHand.set(mat, (onHand.get(mat) ?? 0) + Number(s.quantity ?? 0));
    }

    const demandRecs = new Map<string, Array<{ date: string; qty: number }>>();
    for (const r of this.records(trendRes)) {
      const mat = String(r.materialId ?? r.productId ?? '');
      if (!mat) continue;
      const date = String(r.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const arr = demandRecs.get(mat) ?? [];
      arr.push({ date, qty: Number(r.totalQty ?? r.outboundQty ?? r.qty ?? 0) });
      demandRecs.set(mat, arr);
    }

    // Inbound + supplier per material, and supplier lead times from the master.
    const leadByName = new Map<string, number>();
    for (const s of this.records(supRes)) {
      if (s.name && s.leadTimeDays !== undefined) leadByName.set(String(s.name), Number(s.leadTimeDays));
    }
    const inbound = new Map<string, { qty: number; etaDays: number | null; supplier: string | null }>();
    const now = Date.now();
    for (const po of this.records(poRes)) {
      if (String(po.status ?? '') === 'delivered') continue;
      const mat = String(po.materialId ?? po.productId ?? '');
      if (!mat) continue;
      const due = Date.parse(String(po.expectedDelivery ?? ''));
      const etaDays = Number.isNaN(due) ? null : Math.round((due - now) / 86_400_000);
      const cur = inbound.get(mat) ?? { qty: 0, etaDays: null, supplier: null };
      cur.qty += Number(po.qty ?? 0);
      if (cur.etaDays === null || (etaDays !== null && etaDays < cur.etaDays)) cur.etaDays = etaDays;
      cur.supplier = cur.supplier ?? (String(po.supplier ?? '') || null);
      inbound.set(mat, cur);
    }

    const risks: StockoutRisk[] = [];
    for (const [mat, qty] of onHand) {
      const recs = demandRecs.get(mat);
      const f = recs && recs.length ? holtForecast(toDailySeries(recs, 14), 7) : null;
      const dailyDemand = f ? f.dailyDemand : 0;
      if (dailyDemand <= 0) continue; // no demand → no stockout risk

      const daysToStockout = Math.floor(qty / dailyDemand);
      if (daysToStockout >= HORIZON_DAYS) continue; // not imminent

      const inb = inbound.get(mat) ?? { qty: 0, etaDays: null, supplier: null };
      const supplier = inb.supplier;
      const leadTimeDays = (supplier && leadByName.get(supplier)) || DEFAULT_LEAD_DAYS;
      const covered = inb.qty > 0 && inb.etaDays !== null && inb.etaDays <= daysToStockout;

      const { reorderPoint: rp } = f ? reorderPoint(f, leadTimeDays) : { reorderPoint: 0 };
      const recommendedOrderQty = Math.max(rp - qty - inb.qty, 0);

      const severity: StockoutRisk['severity'] = covered
        ? 'watch'
        : daysToStockout < 3
          ? 'critical'
          : daysToStockout < leadTimeDays
            ? 'high'
            : 'watch';

      risks.push({
        warehouseId,
        materialId: mat,
        onHand: qty,
        dailyDemand: Math.round(dailyDemand * 100) / 100,
        daysToStockout,
        inboundQty: inb.qty,
        inboundEtaDays: inb.etaDays,
        covered,
        supplier,
        leadTimeDays,
        recommendedOrderQty,
        severity,
      });
    }
    return risks;
  }

  /** Ranked radar across a user's in-scope warehouses (soonest, uncovered first). */
  async radar(user: AuthUser): Promise<{
    risks: StockoutRisk[];
    summary: { critical: number; high: number; uncovered: number };
    notAssessed: Array<{ warehouseId: string; reason: string }>;
  }> {
    // Stockout risk is days-of-cover, which needs consumption history. The
    // connected SAP feed has no posting timestamps, so live plants produce no
    // demand series and silently dropped out of the radar — leaving only demo
    // plants on screen, which reads as "your SAP plants are all healthy".
    const scoped = await this.scopedWarehouses(user);
    const perWarehouse = await Promise.all(scoped.map((wh) => this.warehouseRisks(wh)));
    const notAssessed: Array<{ warehouseId: string; reason: string }> = [];
    for (const [i, wh] of scoped.entries()) {
      if (perWarehouse[i].length === 0) {
        const hasStock = this.records(
          await this.mcp.callTool('listWarehouseStock', { warehouseId: wh }, null, true).catch(() => null),
        ).length;
        if (hasStock) {
          notAssessed.push({
            warehouseId: wh,
            reason:
              'no consumption history — the connected SAP material-document feed carries no posting date, ' +
              'so days-of-cover cannot be calculated for this plant',
          });
        }
      }
    }
    const all: StockoutRisk[] = perWarehouse.flat();
    all.sort((a, b) => Number(a.covered) - Number(b.covered) || a.daysToStockout - b.daysToStockout);
    return {
      risks: all,
      summary: {
        critical: all.filter((r) => r.severity === 'critical').length,
        high: all.filter((r) => r.severity === 'high').length,
        uncovered: all.filter((r) => !r.covered).length,
      },
      notAssessed,
    };
  }

  /**
   * Proactive scan (every 4h): notify users scoped to a warehouse when a material
   * becomes critically low and is NOT covered by inbound. Deduped per day.
   */
  @Cron('0 */4 * * *')
  async scheduledScan() {
    try {
      for (const wh of await this.landscape.warehouseIds()) {
        const risks = (await this.warehouseRisks(wh)).filter((r) => r.severity === 'critical' && !r.covered);
        for (const r of risks) {
          const key = `radar:notified:${wh}:${r.materialId}:${new Date().toISOString().slice(0, 10)}`;
          const first = await this.redis.raw.set(key, '1', { NX: true, EX: 86400 });
          if (first !== 'OK') continue;

          const users = await this.db.query<{ id: string }>(
            `SELECT DISTINCT u.id FROM users u
             LEFT JOIN user_scopes s ON s.user_id = u.id AND s.warehouse_id = $1
             WHERE u.role = 'admin' OR s.warehouse_id IS NOT NULL`,
            [wh],
          );
          const body = `${r.materialId} in warehouse ${wh} runs out in ~${r.daysToStockout} day(s) at current demand (${r.dailyDemand}/day) and no inbound covers it. Recommended order: ${r.recommendedOrderQty} units${r.supplier ? ` from ${r.supplier}` : ''}.`;
          for (const u of users.rows) {
            const row = await this.db.query(
              'INSERT INTO notifications(user_id, title, body) VALUES($1, $2, $3) RETURNING *',
              [u.id, `Stockout risk — ${r.materialId} (WH ${wh})`, body],
            );
            this.realtime.emitNotification(u.id, row.rows[0]);
          }
        }
      }
    } catch (error) {
      this.logger.warn(`stockout scan failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
