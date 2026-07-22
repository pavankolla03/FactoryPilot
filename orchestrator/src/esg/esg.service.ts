import { Injectable, Logger } from '@nestjs/common';
import { McpService } from '../mcp/mcp.service';
import type { AuthUser } from '../common/types';

const WAREHOUSES = ['1010', '1020', '1030', '1040', '1050'];

// Illustrative activity-based emission factors (kg CO2e). Documented as estimates;
// a real deployment plugs in the customer's own factors / SAP sustainability data.
const HANDLING_KG_PER_MOVE = 0.6; // forklift/handling energy per warehouse move
const MODE_FACTOR: Record<string, number> = {
  road: 8e-5, // kg CO2e per unit-km
  rail: 2e-5,
  sea: 1.5e-5,
  air: 5e-4,
};
// Supplier country → approximate inbound distance (km) and freight mode to the plant.
const COUNTRY: Record<string, { distanceKm: number; mode: keyof typeof MODE_FACTOR }> = {
  DE: { distanceKm: 300, mode: 'road' },
  CZ: { distanceKm: 500, mode: 'road' },
  NL: { distanceKm: 550, mode: 'road' },
  FR: { distanceKm: 700, mode: 'road' },
  GB: { distanceKm: 900, mode: 'road' },
  IT: { distanceKm: 1000, mode: 'road' },
  HR: { distanceKm: 1100, mode: 'road' },
  SE: { distanceKm: 1300, mode: 'road' },
  CN: { distanceKm: 9000, mode: 'sea' },
};
const DEFAULT_COUNTRY = { distanceKm: 800, mode: 'road' as const };

export interface WarehouseEsg {
  warehouseId: string;
  transportKg: number;
  handlingKg: number;
  totalKg: number;
  unitsMoved: number;
  intensityKgPerUnit: number;
}

export interface EsgReport {
  warehouses: WarehouseEsg[];
  summary: {
    totalKg: number;
    transportKg: number;
    handlingKg: number;
    intensityKgPerUnit: number;
    byMode: Array<{ mode: string; kg: number }>;
    topSuppliers: Array<{ supplier: string; kg: number; mode: string }>;
    dailyTrend: Array<{ day: string; kg: number }>;
  };
}

type Rec = Record<string, unknown>;

/**
 * ESG / Sustainability (Phase AC): activity-based carbon estimate from inbound
 * transport (supplier distance × freight mode) and internal handling (movement
 * activity). Per-warehouse footprint, mode/supplier breakdown, intensity and a
 * daily trend — all from data already flowing, no new SAP dependency.
 */
@Injectable()
export class EsgService {
  private readonly logger = new Logger(EsgService.name);

  constructor(private readonly mcp: McpService) {}

  private records(result: unknown): Rec[] {
    return ((result as { structuredContent?: { records?: Rec[] } })?.structuredContent?.records ?? []) as Rec[];
  }

  private scopedWarehouses(user: AuthUser): string[] {
    if (user.role === 'admin') return WAREHOUSES;
    const set = new Set(user.scopes.map((s) => s.warehouseId));
    return WAREHOUSES.filter((w) => set.has(w));
  }

  async report(user: AuthUser): Promise<EsgReport> {
    const supRecs = this.records(await this.mcp.callTool('getSuppliers', {}).catch(() => null));
    const countryByName = new Map<string, string>();
    for (const s of supRecs) {
      if (s.name) countryByName.set(String(s.name), String(s.country ?? ''));
    }

    const byMode = new Map<string, number>();
    const bySupplier = new Map<string, { kg: number; mode: string }>();
    const trendByDay = new Map<string, number>();

    const per = await Promise.all(
      this.scopedWarehouses(user).map(async (warehouseId) => {
        const [trendRes, poRes] = await Promise.all([
          this.mcp.callTool('getDemandTrend', { warehouseId, days: 30 }).catch(() => null),
          this.mcp.callTool('getPurchaseOrders', { warehouseId }).catch(() => null),
        ]);

        // Internal handling from daily movement activity.
        let handlingKg = 0;
        let unitsMoved = 0;
        for (const d of this.records(trendRes)) {
          const moves = Number(d.moves ?? 0);
          const kg = moves * HANDLING_KG_PER_MOVE;
          handlingKg += kg;
          unitsMoved += Number(d.totalQty ?? 0);
          const day = String(d.day ?? '').slice(0, 10);
          if (day) trendByDay.set(day, (trendByDay.get(day) ?? 0) + kg);
        }

        // Inbound transport by supplier distance × mode.
        let transportKg = 0;
        for (const po of this.records(poRes)) {
          const qty = Number(po.qty ?? 0);
          const supplier = String(po.supplier ?? 'unknown');
          const country = countryByName.get(supplier) || '';
          const geo = COUNTRY[country] ?? DEFAULT_COUNTRY;
          const kg = Math.round(qty * geo.distanceKm * MODE_FACTOR[geo.mode]);
          transportKg += kg;
          byMode.set(geo.mode, (byMode.get(geo.mode) ?? 0) + kg);
          const cur = bySupplier.get(supplier) ?? { kg: 0, mode: geo.mode };
          cur.kg += kg;
          bySupplier.set(supplier, cur);
        }

        handlingKg = Math.round(handlingKg);
        const totalKg = handlingKg + transportKg;
        return {
          warehouseId,
          transportKg,
          handlingKg,
          totalKg,
          unitsMoved,
          intensityKgPerUnit: unitsMoved > 0 ? Math.round((totalKg / unitsMoved) * 100) / 100 : 0,
        };
      }),
    );

    const transportKg = per.reduce((s, w) => s + w.transportKg, 0);
    const handlingKg = per.reduce((s, w) => s + w.handlingKg, 0);
    const totalKg = transportKg + handlingKg;
    const unitsMoved = per.reduce((s, w) => s + w.unitsMoved, 0);

    return {
      warehouses: per.sort((a, b) => b.totalKg - a.totalKg),
      summary: {
        totalKg,
        transportKg,
        handlingKg,
        intensityKgPerUnit: unitsMoved > 0 ? Math.round((totalKg / unitsMoved) * 100) / 100 : 0,
        byMode: [...byMode.entries()].map(([mode, kg]) => ({ mode, kg })).sort((a, b) => b.kg - a.kg),
        topSuppliers: [...bySupplier.entries()]
          .map(([supplier, v]) => ({ supplier, kg: v.kg, mode: v.mode }))
          .sort((a, b) => b.kg - a.kg)
          .slice(0, 5),
        dailyTrend: [...trendByDay.entries()].map(([day, kg]) => ({ day, kg: Math.round(kg) })).sort((a, b) => a.day.localeCompare(b.day)),
      },
    };
  }

  /** CSV of the per-warehouse footprint. */
  async csv(user: AuthUser): Promise<string> {
    const report = await this.report(user);
    const cols = ['warehouse', 'transport_kg_co2e', 'handling_kg_co2e', 'total_kg_co2e', 'units_moved', 'intensity_kg_per_unit'];
    const lines = [cols.join(',')];
    for (const w of report.warehouses) {
      lines.push([w.warehouseId, w.transportKg, w.handlingKg, w.totalKg, w.unitsMoved, w.intensityKgPerUnit].join(','));
    }
    lines.push(['TOTAL', report.summary.transportKg, report.summary.handlingKg, report.summary.totalKg, '', report.summary.intensityKgPerUnit].join(','));
    return lines.join('\n');
  }
}
