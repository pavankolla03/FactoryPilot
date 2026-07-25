import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import { LiveDataService } from './live-data.service';
import { ConnectionsService } from '../connections/connections.service';
import type { AuthUser } from '../common/types';

/** Fallback plants when no SAP landscape is connected (the demo dataset). */
const DEMO_PLANTS = ['1010', '1020', '1030', '1040', '1050'];

export interface PlantInfo {
  warehouseId: string;
  live: boolean;
  positions: number;
}

export interface LandscapeCoverage {
  connected: boolean;
  plants: PlantInfo[];
  objects: Array<{ object: string; live: boolean; note: string }>;
}

/**
 * Single source of truth for which plants the product should show (Phase AG).
 * When a SAP landscape is connected the list comes from real data, so the app
 * stops advertising demo warehouses that do not exist in the customer's system.
 */
@Injectable()
export class LandscapeService {
  private readonly logger = new Logger(LandscapeService.name);
  private cache: { at: number; plants: PlantInfo[] } | null = null;

  constructor(
    private readonly db: DbService,
    private readonly live: LiveDataService,
    private readonly connections: ConnectionsService,
  ) {}

  /** Plants with live data first, then demo plants that have no live counterpart. */
  async plants(orgId?: string | null): Promise<PlantInfo[]> {
    if (this.cache && Date.now() - this.cache.at < 60_000) {
      return this.cache.plants;
    }

    let livePlants: string[] = [];
    try {
      livePlants = await this.live.livePlants(orgId);
    } catch (error) {
      this.logger.warn(`live plant lookup failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    const counts = new Map<string, number>();
    for (const p of livePlants) {
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }

    const plants: PlantInfo[] = livePlants.map((p) => ({ warehouseId: p, live: true, positions: 0 }));
    // Keep demo plants visible so an unconnected install still works end to end.
    for (const d of DEMO_PLANTS) {
      if (!plants.some((p) => p.warehouseId === d)) {
        plants.push({ warehouseId: d, live: false, positions: 0 });
      }
    }
    plants.sort((a, b) => Number(b.live) - Number(a.live) || a.warehouseId.localeCompare(b.warehouseId));
    this.cache = { at: Date.now(), plants };
    return plants;
  }

  /** Plain id list — what the services iterate over. */
  async warehouseIds(orgId?: string | null): Promise<string[]> {
    return (await this.plants(orgId)).map((p) => p.warehouseId);
  }

  /** Ids a user may see: admins get everything, others only their scopes. */
  async scopedWarehouseIds(user: AuthUser): Promise<string[]> {
    const all = await this.warehouseIds(user.orgId);
    if (user.role === 'admin') {
      return all;
    }
    const set = new Set(user.scopes.map((s) => s.warehouseId));
    return all.filter((w) => set.has(w));
  }

  /**
   * What is live vs simulated right now — so the gap is visible in the UI
   * instead of being inferred from a chip on one card.
   */
  async coverage(orgId?: string | null): Promise<LandscapeCoverage> {
    const plants = await this.plants(orgId);
    const connected = plants.some((p) => p.live);

    const rows = await this.db
      .query<{ object_code: string; object_name: string; entity_set: string; is_active: boolean }>(
        'SELECT object_code, object_name, entity_set, is_active FROM business_objects WHERE is_active = true ORDER BY object_name',
      )
      .catch(() => ({
        rows: [] as Array<{ object_code: string; object_name: string; entity_set: string; is_active: boolean }>,
      }));

    // A fixed-endpoint iFlow serves exactly ONE entity set — every other object
    // routed through it would come back with the wrong payload, so only the
    // object it actually serves may be called live.
    const conn = await this.connections.resolveActive('iflow', orgId);
    const fixed = conn?.fixedEndpoint === true || conn?.fixedEndpoint === 'true';
    const servedEntitySet = fixed ? String(conn?.probeEntitySet ?? '') : '';
    const servesObject = (entitySet: string | null) =>
      connected && (!fixed || (entitySet ?? '') === servedEntitySet);

    const objects = [
      {
        object: 'Material stock',
        live: connected,
        note: connected ? 'Live via the connected iFlow' : 'Simulator — no connection registered',
      },
      { object: 'Movements', live: false, note: 'No live source yet — needs a movements iFlow' },
      { object: 'Purchase orders', live: false, note: 'No live source yet — needs a purchase-order iFlow' },
      { object: 'Demand trend', live: false, note: 'Derived from movements — live once movements are connected' },
      { object: 'Suppliers', live: false, note: 'No live source yet' },
      ...rows.rows
        .filter((r) => r.object_code !== 'MATERIAL_STOCK')
        .map((r) => ({
          object: `${r.object_name} (registry)`,
          live: servesObject(r.entity_set),
          note: !connected
            ? 'Simulator'
            : servesObject(r.entity_set)
              ? 'Queried through the connected iFlow'
              : `Simulator — the connected iFlow only serves ${servedEntitySet || 'one entity set'}`,
        })),
    ];

    return { connected, plants, objects };
  }
}
