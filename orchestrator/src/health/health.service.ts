import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import { McpService } from '../mcp/mcp.service';
import type { AuthUser } from '../common/types';
import { LandscapeService } from '../live/landscape.service';
import { holtForecast, toDailySeries } from '../agents/forecast';

const LOW_THRESHOLD = 50;
const COVER_DAYS_TARGET = 3; // days-of-demand below this is "at risk"

export interface HealthFactor {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number;
  detail: string;
}

export interface WarehouseHealth {
  warehouseId: string;
  score: number;
  band: 'healthy' | 'watch' | 'critical';
  trend: number | null; // vs previous snapshot
  detractor: { label: string; score: number; detail: string } | null;
  factors: HealthFactor[];
  computedAt: string;
}

type Rec = Record<string, unknown>;

/**
 * Warehouse Health Score (Phase X). Turns the raw SAP signals FactoryPilot
 * already reads into one 0-100 daily judgment per warehouse, with a factor
 * breakdown so "explain why" can name the biggest risk. All inputs come from the
 * existing MCP read tools — no new SAP calls to configure.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly db: DbService,
    private readonly mcp: McpService,
    private readonly landscape: LandscapeService,
  ) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  private bandOf(score: number): WarehouseHealth['band'] {
    return score >= 80 ? 'healthy' : score >= 60 ? 'watch' : 'critical';
  }

  /** Compute a fresh score for one warehouse from live tool data. */
  async computeOne(warehouseId: string): Promise<WarehouseHealth> {
    const [stockRes, lowRes, poRes, trendRes, moveRes] = await Promise.all([
      this.mcp.callTool('listWarehouseStock', { warehouseId }).catch(() => null),
      this.mcp.callTool('getLowStock', { warehouseId, threshold: LOW_THRESHOLD }).catch(() => null),
      this.mcp.callTool('getPurchaseOrders', { warehouseId }).catch(() => null),
      this.mcp.callTool('getDemandTrend', { warehouseId, days: 14, byProduct: true }).catch(() => null),
      this.mcp.callTool('getRecentMovements', { warehouseId, sinceHours: 48 }).catch(() => null),
    ]);

    const stock = this.records(stockRes);
    const low = this.records(lowRes);
    const pos = this.records(poRes);
    const trend = this.records(trendRes);
    const moves = this.records(moveRes);

    // Current on-hand per material (summed across locations).
    const onHand = new Map<string, number>();
    for (const r of stock) {
      const mat = String(r.materialId ?? r.productId ?? '');
      if (mat) onHand.set(mat, (onHand.get(mat) ?? 0) + Number(r.quantity ?? 0));
    }
    const distinct = Math.max(onHand.size, 1);

    // Daily demand per material from the 14-day trend (Holt-smoothed).
    const demandByMat = new Map<string, Array<{ date: string; qty: number }>>();
    for (const r of trend) {
      const mat = String(r.materialId ?? r.productId ?? '');
      if (!mat) continue;
      const date = String(r.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const qty = Number(r.totalQty ?? r.outboundQty ?? r.qty ?? 0);
      const arr = demandByMat.get(mat) ?? [];
      arr.push({ date, qty });
      demandByMat.set(mat, arr);
    }
    const dailyDemand = (mat: string): number => {
      const recs = demandByMat.get(mat);
      if (!recs || recs.length === 0) return 0;
      return holtForecast(toDailySeries(recs, 14), 7).dailyDemand;
    };

    // Factor 1 — days-of-cover: materials with < target days of demand are at risk.
    let atRisk = 0;
    let worstCoverMat = '';
    let worstCover = Infinity;
    for (const [mat, qty] of onHand) {
      const d = dailyDemand(mat);
      const cover = d > 0 ? qty / d : Infinity;
      if (cover < COVER_DAYS_TARGET) {
        atRisk += 1;
        if (cover < worstCover) {
          worstCover = cover;
          worstCoverMat = mat;
        }
      }
    }
    const coverageScore = Math.round(100 * (1 - atRisk / distinct));

    // Factor 2 — low-stock breadth (with zero-stock penalty).
    const zeroStock = [...onHand.values()].filter((q) => q <= 0).length;
    const lowScore = Math.round(100 * (1 - Math.min((low.length + zeroStock) / distinct, 1)));

    // Factor 3 — open-PO aging: overdue open POs drag the score.
    const today = new Date().toISOString().slice(0, 10);
    const openPOs = pos.filter((p) => String(p.status ?? '') !== 'delivered');
    const overdue = openPOs.filter((p) => {
      const due = String(p.expectedDelivery ?? p.orderedAt ?? '').slice(0, 10);
      return due && due < today;
    });
    const poScore = openPOs.length === 0 ? 90 : Math.round(100 * (1 - overdue.length / openPOs.length));

    // Factor 4 — movement anomaly rate: moves far above the recent median.
    const qtys = moves.map((m) => Math.abs(Number(m.qty ?? 0))).filter((q) => q > 0).sort((a, b) => a - b);
    const median = qtys.length ? qtys[Math.floor(qtys.length / 2)] : 0;
    const anomalies = median > 0 ? qtys.filter((q) => q >= 5 * median).length : 0;
    const anomalyScore = qtys.length < 3 ? 92 : Math.round(100 * (1 - anomalies / qtys.length));

    const factors: HealthFactor[] = [
      { key: 'coverage', label: 'Days of cover', score: coverageScore, weight: 0.4, detail: atRisk === 0 ? 'all materials above 3 days of demand' : `${atRisk} of ${distinct} materials under ${COVER_DAYS_TARGET} days of cover${worstCoverMat ? ` (worst: ${worstCoverMat}, ${worstCover === Infinity ? '∞' : worstCover.toFixed(1)}d)` : ''}` },
      { key: 'lowStock', label: 'Low stock', score: lowScore, weight: 0.2, detail: low.length + zeroStock === 0 ? 'no positions below threshold' : `${low.length} below ${LOW_THRESHOLD}${zeroStock ? `, ${zeroStock} at zero` : ''}` },
      { key: 'poAging', label: 'PO aging', score: poScore, weight: 0.2, detail: openPOs.length === 0 ? 'no open purchase orders' : `${overdue.length} of ${openPOs.length} open POs overdue` },
      { key: 'anomalies', label: 'Movement anomalies', score: anomalyScore, weight: 0.2, detail: anomalies === 0 ? 'movements within normal range' : `${anomalies} unusually large move(s) in 48h` },
    ];

    const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
    const detractorFactor = [...factors].sort((a, b) => a.score - b.score)[0];
    const detractor = detractorFactor.score < 90 ? { label: detractorFactor.label, score: detractorFactor.score, detail: detractorFactor.detail } : null;

    return {
      warehouseId,
      score,
      band: this.bandOf(score),
      trend: null,
      detractor,
      factors,
      computedAt: new Date().toISOString(),
    };
  }

  /** Warehouses a user may see (admins: all; others: their read scopes). */
  private async scopedWarehouses(user: AuthUser): Promise<string[]> {
    return this.landscape.scopedWarehouseIds(user);
  }

  /** Score for every in-scope warehouse, with trend vs the last stored snapshot. */
  async overview(user: AuthUser): Promise<WarehouseHealth[]> {
    const warehouses = await this.scopedWarehouses(user);
    const out: WarehouseHealth[] = [];
    for (const wh of warehouses) {
      const health = await this.computeOne(wh);
      health.trend = await this.trendAndSnapshot(user, health);
      out.push(health);
    }
    return out.sort((a, b) => a.score - b.score);
  }

  /** Detail for one warehouse (used by the chat "explain" tool). */
  async detail(user: AuthUser, warehouseId: string): Promise<WarehouseHealth> {
    const health = await this.computeOne(warehouseId);
    health.trend = await this.trendAndSnapshot(user, health);
    return health;
  }

  /**
   * Trend vs the most recent snapshot older than ~20h, and persist a new snapshot
   * at most once per hour so history builds without spamming rows.
   */
  private async trendAndSnapshot(user: AuthUser, health: WarehouseHealth): Promise<number | null> {
    try {
      const prev = await this.db.query<{ score: number; computed_at: string }>(
        `SELECT score, computed_at FROM warehouse_health
         WHERE warehouse_id = $1 AND computed_at < NOW() - INTERVAL '20 hours'
         ORDER BY computed_at DESC LIMIT 1`,
        [health.warehouseId],
      );
      const trend = prev.rows[0] ? health.score - prev.rows[0].score : null;

      const recent = await this.db.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM warehouse_health
         WHERE warehouse_id = $1 AND computed_at > NOW() - INTERVAL '1 hour'`,
        [health.warehouseId],
      );
      if ((recent.rows[0]?.n ?? 0) === 0) {
        await this.db.query(
          'INSERT INTO warehouse_health(org_id, warehouse_id, score, factors) VALUES($1, $2, $3, $4::jsonb)',
          [user.orgId ?? null, health.warehouseId, health.score, JSON.stringify(health.factors)],
        );
      }
      return trend;
    } catch (error) {
      this.logger.warn(`health trend/snapshot failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }
}
