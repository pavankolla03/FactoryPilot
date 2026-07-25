import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import { ConnectionsService } from '../connections/connections.service';
import { SapIflowClient, type IflowOverride } from '../business-objects/sap-iflow.client';

/** MCP read tools this adapter can serve from live SAP material stock. */
const LIVE_TOOLS = new Set(['getStockLevel', 'listWarehouseStock', 'getLowStock', 'getWarehouseSummary']);

/** Enough rows to aggregate a plant truthfully; the result is then summarized. */
const FETCH_TOP = 1000;

interface StockRow {
  materialId: string;
  productId: string;
  warehouseId: string;
  location: string;
  quantity: number;
}

/**
 * Live data adapter (Phase AF): serves the MCP read tools from the customer's
 * real SAP landscape when a connection is active, so chat, the board, Insights
 * and the agents stop reading mock data. Tools with no live source yet (movements,
 * purchase orders, demand trend) keep falling through to the simulator, and every
 * payload says which system answered.
 */
@Injectable()
export class LiveDataService {
  private readonly logger = new Logger(LiveDataService.name);
  private readonly iflow = new SapIflowClient();
  private cache: { at: number; rows: StockRow[] } | null = null;

  constructor(
    private readonly db: DbService,
    private readonly connections: ConnectionsService,
  ) {}

  canServe(toolName: string): boolean {
    return LIVE_TOOLS.has(toolName);
  }

  private async landscape(orgId?: string | null): Promise<IflowOverride | null> {
    const iflow = await this.connections.resolveActive('iflow', orgId);
    if (iflow?.url) return iflow as IflowOverride;
    const s4 = await this.connections.resolveActive('s4hana', orgId);
    if (s4?.baseUrl) return s4 as IflowOverride;
    return null;
  }

  /** Fetch + normalize live stock once per 60s (the iFlow returns the full plant set). */
  private async liveStock(orgId?: string | null): Promise<StockRow[] | null> {
    const landscape = await this.landscape(orgId);
    if (!landscape) return null;

    if (this.cache && Date.now() - this.cache.at < 60_000) {
      return this.cache.rows;
    }

    const cfg = await this.db.query<{
      odata_service_path: string;
      entity_set: string;
      select_fields: string | null;
    }>(
      `SELECT odata_service_path, entity_set, select_fields FROM business_objects
       WHERE object_code = 'MATERIAL_STOCK' AND is_active = true
       ORDER BY org_id NULLS LAST LIMIT 1`,
    );
    const obj = cfg.rows[0];
    if (!obj) return null;

    try {
      const result = await this.iflow.query(
        {
          service: obj.odata_service_path,
          entitySet: obj.entity_set,
          select: obj.select_fields || undefined,
          top: FETCH_TOP,
        },
        landscape,
      );
      const rows: StockRow[] = result.records
        .map((r) => ({
          materialId: String(r.Material ?? r.materialId ?? ''),
          productId: String(r.Material ?? r.productId ?? ''),
          warehouseId: String(r.Plant ?? r.warehouseId ?? ''),
          location: String(r.StorageLocation ?? r.location ?? '') || 'unassigned',
          quantity: Number(r.MatlWrhsStkQtyInMatlBaseUnit ?? r.quantity ?? 0),
        }))
        .filter((r) => r.materialId && r.warehouseId);
      this.cache = { at: Date.now(), rows };
      return rows;
    } catch (error) {
      this.logger.warn(`live stock fetch failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }

  /** Merge duplicate (material, location) lines into one position. */
  private aggregate(rows: StockRow[]): StockRow[] {
    const byKey = new Map<string, StockRow>();
    for (const r of rows) {
      const key = `${r.materialId}@${r.location}`;
      const cur = byKey.get(key);
      if (cur) {
        cur.quantity += r.quantity;
      } else {
        byKey.set(key, { ...r });
      }
    }
    return [...byKey.values()].sort((a, b) => a.materialId.localeCompare(b.materialId));
  }

  /**
   * Serve an MCP read tool from live SAP. Returns null when there is no live
   * source (or no rows for that plant) so the caller falls back to the simulator.
   */
  async serve(
    toolName: string,
    params: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    if (!this.canServe(toolName)) return null;

    const all = await this.liveStock(orgId);
    if (!all) return null;

    const warehouseId = params.warehouseId ? String(params.warehouseId) : undefined;
    const scoped = warehouseId ? all.filter((r) => r.warehouseId === warehouseId) : all;
    // No live rows for this plant — let the simulator answer rather than
    // pretending the warehouse is empty.
    if (scoped.length === 0) return null;

    const dataSource = 'sap-iflow (live)';

    if (toolName === 'listWarehouseStock') {
      return { structuredContent: { records: this.aggregate(scoped), dataSource } };
    }

    if (toolName === 'getStockLevel') {
      const materialId = String(params.materialId ?? '');
      const records = this.aggregate(scoped.filter((r) => r.materialId === materialId));
      return { structuredContent: { records, dataSource } };
    }

    if (toolName === 'getLowStock') {
      const threshold = Number(params.threshold ?? 50);
      const records = this.aggregate(scoped)
        .filter((r) => r.quantity < threshold)
        .sort((a, b) => a.quantity - b.quantity)
        .map((r) => ({ ...r, description: '', inboundQty: 0 }));
      return { structuredContent: { records, dataSource } };
    }

    // getWarehouseSummary
    const agg = this.aggregate(scoped);
    const byLocation: Record<string, number> = {};
    for (const r of agg) {
      byLocation[r.location] = (byLocation[r.location] ?? 0) + r.quantity;
    }
    return {
      structuredContent: {
        warehouseId: warehouseId ?? '',
        distinctMaterials: new Set(agg.map((r) => r.materialId)).size,
        totalQuantity: agg.reduce((s, r) => s + r.quantity, 0),
        byLocation,
        movementsLast24h: 0,
        openPurchaseOrders: 0,
        dataSource,
        note: 'Stock is live from SAP. Movement and purchase-order counts have no live source connected yet.',
      },
    };
  }

  /** Plants that actually have live stock — used to show what is connected. */
  async livePlants(orgId?: string | null): Promise<string[]> {
    const rows = await this.liveStock(orgId);
    if (!rows) return [];
    return [...new Set(rows.map((r) => r.warehouseId))].sort();
  }
}
