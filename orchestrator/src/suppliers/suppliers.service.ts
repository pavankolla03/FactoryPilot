import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import type { AuthUser } from '../common/types';

const WAREHOUSES = ['1010', '1020', '1030', '1040', '1050'];

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
  reliabilityScore: number;
  band: 'reliable' | 'watch' | 'at-risk';
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

  constructor(private readonly mcp: McpService) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  private scopedWarehouses(user: AuthUser): string[] {
    if (user.role === 'admin') return WAREHOUSES;
    const set = new Set(user.scopes.map((s) => s.warehouseId));
    return WAREHOUSES.filter((w) => set.has(w));
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

    // All POs across in-scope warehouses (dedup by poNumber).
    const poByNumber = new Map<string, Rec>();
    for (const wh of this.scopedWarehouses(user)) {
      const pos = this.records(await this.mcp.callTool('getPurchaseOrders', { warehouseId: wh }).catch(() => null));
      for (const po of pos) poByNumber.set(String(po.poNumber ?? Math.random()), po);
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

    // Every supplier from the master, plus any PO supplier not in the master.
    const names = new Set<string>([...master.map((m) => String(m.name ?? '')), ...bySupplier.keys()].filter(Boolean));

    const cards: SupplierScorecard[] = [];
    for (const name of names) {
      const m = master.find((x) => String(x.name ?? '') === name);
      const agg = bySupplier.get(name) ?? { open: 0, overdue: 0, qty: 0, leadDays: [] };
      const onTime = m?.onTimeRatePct !== undefined ? Number(m.onTimeRatePct) : null;
      const promisedLead = agg.leadDays.length
        ? Math.round(agg.leadDays.reduce((s, v) => s + v, 0) / agg.leadDays.length)
        : null;

      // Reliability: the supplier's on-time rate is the stable signal; long lead
      // times and current overdue POs are smaller, count-based nudges (so one late
      // PO can't sink an otherwise-reliable supplier below a chronically weak one).
      const base = onTime ?? 80;
      const leadDays = m?.leadTimeDays !== undefined ? Number(m.leadTimeDays) : (promisedLead ?? 10);
      const leadPenalty = Math.min(10, Math.max(0, leadDays - 10) * 0.6);
      const overduePenalty = Math.min(20, agg.overdue * 8);
      const reliabilityScore = Math.max(0, Math.min(100, Math.round(base - leadPenalty - overduePenalty)));

      cards.push({
        supplierId: m?.supplierId ? String(m.supplierId) : null,
        name,
        country: m?.country ? String(m.country) : null,
        onTimeRatePct: onTime,
        leadTimeDays: m?.leadTimeDays !== undefined ? Number(m.leadTimeDays) : null,
        promisedLeadDays: promisedLead,
        openPOs: agg.open,
        overduePOs: agg.overdue,
        qtyOnOrder: agg.qty,
        reliabilityScore,
        band: this.bandOf(reliabilityScore),
      });
    }

    // Worst-first, but suppliers with open exposure rank above idle ones at equal score.
    return cards.sort((a, b) => a.reliabilityScore - b.reliabilityScore || b.openPOs - a.openPOs);
  }

  /** Lead time to use for reorder-point math for a given supplier (measured, else declared). */
  async leadTimeFor(user: AuthUser, supplierName: string): Promise<number | null> {
    const cards = await this.scorecards(user);
    const c = cards.find((x) => x.name === supplierName);
    return c ? (c.promisedLeadDays ?? c.leadTimeDays) : null;
  }
}
