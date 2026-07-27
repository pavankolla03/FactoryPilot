import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import type { AuthUser } from '../common/types';
import { LandscapeService } from '../live/landscape.service';


export interface SupplierScorecard {
  supplierId: string | null;
  name: string;
  country: string | null;
  onTimeRatePct: number | null;
  leadTimeDays: number | null;
  promisedLeadDays: number | null; // measured from this supplier's PO history
  openPOs: number;
  overduePOs: number;
  qtyOnOrder: number;
  /** Null when the landscape supplies no signal to score on — unknown, not bad. */
  reliabilityScore: number | null;
  band: 'reliable' | 'watch' | 'at-risk' | null;
  scoreUnavailableReason?: string | null;
}

type Rec = Record<string, unknown>;

/**
 * Supplier intelligence (Phase Y): scorecards from the supplier master
 * (on-time rate, lead time) joined with live PO exposure (open/overdue/qty on
 * order and measured promised lead time). Ranks suppliers by reliability so the
 * PO-chase agent and buyers can prioritize the real risks.
 */
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly mcp: McpService,
    private readonly landscape: LandscapeService,) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  private async scopedWarehouses(user: AuthUser): Promise<string[]> {
    return this.landscape.scopedWarehouseIds(user);
  }

  private bandOf(score: number): SupplierScorecard['band'] {
    return score >= 85 ? 'reliable' : score >= 70 ? 'watch' : 'at-risk';
  }

  private daysBetween(a: string, b: string): number | null {
    const d1 = Date.parse(a), d2 = Date.parse(b);
    if (Number.isNaN(d1) || Number.isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86_400_000);
  }

  async scorecards(user: AuthUser): Promise<SupplierScorecard[]> {
    const master = this.records(await this.mcp.callTool('getSuppliers', {}).catch(() => null));

    // All POs (dedup by poNumber). Live SAP purchase order headers carry no
    // plant, so a per-warehouse loop returns nothing at all — ask once without
    // a warehouse and fall back to the per-warehouse sweep for simulator data.
    const poByNumber = new Map<string, Rec>();
    const unscoped = this.records(await this.mcp.callTool('getPurchaseOrders', {}).catch(() => null));
    for (const po of unscoped) poByNumber.set(String(po.poNumber ?? Math.random()), po);
    if (!poByNumber.size) {
      for (const wh of await this.scopedWarehouses(user)) {
        const pos = this.records(await this.mcp.callTool('getPurchaseOrders', { warehouseId: wh }).catch(() => null));
        for (const po of pos) poByNumber.set(String(po.poNumber ?? Math.random()), po);
      }
    }
    const pos = [...poByNumber.values()];

    const today = new Date().toISOString().slice(0, 10);
    const bySupplier = new Map<string, { open: number; overdue: number; qty: number; leadDays: number[] }>();
    for (const po of pos) {
      const name = String(po.supplier ?? 'unknown');
      const agg = bySupplier.get(name) ?? { open: 0, overdue: 0, qty: 0, leadDays: [] };
      const status = String(po.status ?? '');
      const isOpen = status !== 'delivered';
      if (isOpen) {
        agg.open += 1;
        agg.qty += Number(po.qty ?? 0);
        const due = String(po.expectedDelivery ?? '').slice(0, 10);
        if (due && due < today) agg.overdue += 1;
      }
      const lead = this.daysBetween(String(po.orderedAt ?? ''), String(po.expectedDelivery ?? ''));
      if (lead !== null && lead >= 0) agg.leadDays.push(lead);
      bySupplier.set(name, agg);
    }

    // Key on whatever identifies the supplier in this landscape: live SAP gives
    // an ID and no name, the simulator gives a name and no ID.
    const keyOf = (r: Rec) => String(r.supplierId ?? r.name ?? '').trim();
    const keys = new Set<string>([...master.map(keyOf), ...bySupplier.keys()].filter(Boolean));

    const cards: SupplierScorecard[] = [];
    for (const key of keys) {
      const m = master.find((x) => keyOf(x) === key);
      const agg = bySupplier.get(key) ?? { open: 0, overdue: 0, qty: 0, leadDays: [] };
      const onTime =
        m?.onTimeRatePct !== undefined && m.onTimeRatePct !== null ? Number(m.onTimeRatePct) : null;
      const declaredLead =
        m?.leadTimeDays !== undefined && m.leadTimeDays !== null ? Number(m.leadTimeDays) : null;
      const promisedLead = agg.leadDays.length
        ? Math.round(agg.leadDays.reduce((s, v) => s + v, 0) / agg.leadDays.length)
        : null;

      // Reliability: the supplier's on-time rate is the stable signal; long lead
      // times and current overdue POs are smaller, count-based nudges (so one late
      // PO can't sink an otherwise-reliable supplier below a chronically weak one).
      //
      // With none of those signals present — live SAP PO headers carry no
      // delivery date, status or quantity — there is nothing to score. Emitting
      // the old default of 80 gave every supplier an identical "reliable" badge
      // that looked measured, so the score is left null instead.
      const hasSignal = onTime !== null || declaredLead !== null || promisedLead !== null || agg.overdue > 0;
      const leadDays = declaredLead ?? promisedLead ?? 10;
      const reliabilityScore = hasSignal
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                (onTime ?? 80) -
                  Math.min(10, Math.max(0, leadDays - 10) * 0.6) -
                  Math.min(20, agg.overdue * 8),
              ),
            ),
          )
        : null;

      cards.push({
        supplierId: m?.supplierId ? String(m.supplierId) : /^\d|-/.test(key) ? key : null,
        name: m?.name ? String(m.name) : key,
        country: m?.country ? String(m.country) : null,
        onTimeRatePct: onTime,
        leadTimeDays: declaredLead,
        promisedLeadDays: promisedLead,
        openPOs: agg.open,
        overduePOs: agg.overdue,
        qtyOnOrder: agg.qty,
        reliabilityScore,
        band: reliabilityScore === null ? null : this.bandOf(reliabilityScore),
        scoreUnavailableReason: hasSignal
          ? null
          : 'No delivery dates, statuses or quantities are available for this supplier — ' +
            'the connected SAP iFlow serves purchase order headers only.',
      });
    }

    // Worst-first, but suppliers with open exposure rank above idle ones at equal
    // score. Unscored suppliers sort last: they are unknown, not bad.
    return cards.sort(
      (a, b) =>
        (a.reliabilityScore ?? 101) - (b.reliabilityScore ?? 101) || b.openPOs - a.openPOs,
    );
  }

  /** Lead time to use for reorder-point math for a given supplier (measured, else declared). */
  async leadTimeFor(user: AuthUser, supplierName: string): Promise<number | null> {
    const cards = await this.scorecards(user);
    const c = cards.find((x) => x.name === supplierName);
    return c ? (c.promisedLeadDays ?? c.leadTimeDays) : null;
  }
}
