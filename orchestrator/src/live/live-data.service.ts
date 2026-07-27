import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import { ConnectionsService } from '../connections/connections.service';
import { RedisService } from '../common/redis.service';
import { SapIflowClient, type IflowOverride } from '../business-objects/sap-iflow.client';

/** MCP read tools this adapter can serve from live SAP. */
const LIVE_TOOLS = new Set([
  'getStockLevel',
  'listWarehouseStock',
  'getLowStock',
  'getWarehouseSummary',
  // Phase AN: backed by the material-document and purchase-order iFlows.
  'getRecentMovements',
  'getPurchaseOrders',
  // Phase AO: derived from the same live payloads rather than the simulator.
  // No product-master or supplier-master iFlow is connected, so these carry
  // identifiers and stock facts but not descriptions or supplier names.
  'searchMaterials',
  'getMaterialDetails',
  'getSuppliers',
]);

/** Enough rows to aggregate a plant truthfully; the result is then summarized. */
const FETCH_TOP = 1000;

/**
 * Rows handed to the model per answer. A large plant returns hundreds of
 * positions (~10k tokens); the model only needs a representative slice plus
 * accurate totals, and it is always told what was withheld.
 */
const RESPONSE_ROW_BUDGET = Number(process.env.LIVE_ROW_BUDGET || 30);

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
  private cache: { at: number; rows: StockRow[]; fetchedAt: number; degraded: boolean } | null = null;
  /** Per-business-object raw row cache (movements, purchase orders, …). */
  private objectCache = new Map<string, { at: number; rows: Array<Record<string, unknown>> }>();

  /** Survives restarts, so a SAP outage at boot still has something truthful to serve. */
  private static readonly SNAPSHOT_KEY = 'live:stock:last-known-good';
  private static readonly SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600;

  constructor(
    private readonly db: DbService,
    private readonly connections: ConnectionsService,
    private readonly redis: RedisService,
  ) {}

  /** How stale the currently served data is, in minutes (0 = fresh). */
  private staleMinutes(fetchedAt: number): number {
    return Math.max(0, Math.floor((Date.now() - fetchedAt) / 60_000));
  }

  canServe(toolName: string): boolean {
    return LIVE_TOOLS.has(toolName);
  }

  private async landscape(orgId?: string | null, entitySet?: string): Promise<IflowOverride | null> {
    const iflow = entitySet
      ? await this.connections.resolveForEntitySet(entitySet, orgId)
      : await this.connections.resolveActive('iflow', orgId);
    if (iflow?.url) return iflow as IflowOverride;
    const s4 = await this.connections.resolveActive('s4hana', orgId);
    if (s4?.baseUrl) return s4 as IflowOverride;
    return null;
  }

  /** Fetch + normalize live stock once per 60s (the iFlow returns the full plant set). */
  private async liveStock(
    orgId?: string | null,
  ): Promise<{ rows: StockRow[]; fetchedAt: number; degraded: boolean } | null> {
    if (this.cache && Date.now() - this.cache.at < 60_000) {
      return { rows: this.cache.rows, fetchedAt: this.cache.fetchedAt, degraded: this.cache.degraded };
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

    const landscape = await this.landscape(orgId, obj.entity_set);
    if (!landscape) return null;

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
      const fetchedAt = Date.now();
      this.cache = { at: fetchedAt, rows, fetchedAt, degraded: false };
      await this.saveSnapshot(rows, fetchedAt);
      await this.recordHealth(landscape, true);
      return { rows, fetchedAt, degraded: false };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`live stock fetch failed: ${reason}`);
      await this.recordHealth(landscape, false, reason);

      // Resilience (Phase AK): serve the last good SAP payload, clearly marked
      // stale, instead of silently reverting to simulated numbers.
      const snapshot = await this.loadSnapshot();
      if (snapshot) {
        this.logger.warn(`serving last-known-good SAP stock (${this.staleMinutes(snapshot.fetchedAt)}m old)`);
        this.cache = { at: Date.now(), rows: snapshot.rows, fetchedAt: snapshot.fetchedAt, degraded: true };
        return { ...snapshot, degraded: true };
      }
      return null;
    }
  }

  /**
   * Fetch any registered business object from the customer's landscape, routed
   * to the iFlow bound to its entity set. Cached for 60s like stock. Returns
   * null when nothing live is connected for that object, so the caller falls
   * back to the simulator rather than showing an empty warehouse.
   */
  private async fetchObject(
    objectCode: string,
    orgId?: string | null,
  ): Promise<Array<Record<string, unknown>> | null> {
    const cached = this.objectCache.get(objectCode);
    if (cached && Date.now() - cached.at < 60_000) return cached.rows;

    const cfg = await this.db.query<{
      odata_service_path: string;
      entity_set: string;
      select_fields: string | null;
      top_limit: number;
    }>(
      `SELECT odata_service_path, entity_set, select_fields, top_limit FROM business_objects
       WHERE object_code = $1 AND is_active = true
       ORDER BY org_id NULLS LAST LIMIT 1`,
      [objectCode],
    );
    const obj = cfg.rows[0];
    if (!obj) return null;

    const landscape = await this.landscape(orgId, obj.entity_set);
    if (!landscape) return null;

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
      // A fixed endpoint that quietly serves a different entity set would produce
      // nonsense downstream; an empty result is treated as "no live source".
      if (!result.records.length) return null;
      this.objectCache.set(objectCode, { at: Date.now(), rows: result.records });
      await this.recordHealth(landscape, true);
      return result.records;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`live ${objectCode} fetch failed: ${reason}`);
      await this.recordHealth(landscape, false, reason);
      return cached?.rows ?? null;
    }
  }

  private async saveSnapshot(rows: StockRow[], fetchedAt: number) {
    try {
      await this.redis.raw.setEx(
        LiveDataService.SNAPSHOT_KEY,
        LiveDataService.SNAPSHOT_TTL_SECONDS,
        JSON.stringify({ fetchedAt, rows }),
      );
    } catch {
      /* snapshot is best-effort */
    }
  }

  private async loadSnapshot(): Promise<{ rows: StockRow[]; fetchedAt: number } | null> {
    try {
      const raw = await this.redis.raw.get(LiveDataService.SNAPSHOT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { fetchedAt: number; rows: StockRow[] };
      return parsed.rows?.length ? { rows: parsed.rows, fetchedAt: parsed.fetchedAt } : null;
    } catch {
      return null;
    }
  }

  /** Track whether live data is actually flowing, for the Connections view. */
  private async recordHealth(landscape: IflowOverride | null, ok: boolean, message?: string) {
    const id = (landscape as unknown as { id?: string })?.id;
    if (!id) return;
    try {
      await this.db.query(
        ok
          ? `UPDATE connections SET last_success_at = NOW(), consecutive_failures = 0,
               status = 'ok', last_message = 'Live data flowing' WHERE id = $1`
          : `UPDATE connections SET consecutive_failures = consecutive_failures + 1,
               status = 'error', last_message = $2 WHERE id = $1`,
        ok ? [id] : [id, (message ?? 'fetch failed').slice(0, 300)],
      );
    } catch {
      /* health tracking must never break a read */
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
    /** UI surfaces (the board) render every position; only model payloads are budgeted. */
    full = false,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    if (!this.canServe(toolName)) return null;

    if (toolName === 'getRecentMovements') return this.serveMovements(params, orgId);
    if (toolName === 'getPurchaseOrders') return this.servePurchaseOrders(params, orgId);
    if (toolName === 'getSuppliers') return this.serveSuppliers(orgId);
    if (toolName === 'searchMaterials' || toolName === 'getMaterialDetails') {
      return this.serveMaterials(toolName, params, orgId);
    }

    const live = await this.liveStock(orgId);
    if (!live) return null;
    const all = live.rows;

    const warehouseId = params.warehouseId ? String(params.warehouseId) : undefined;
    const scoped = warehouseId ? all.filter((r) => r.warehouseId === warehouseId) : all;
    // No live rows for this plant — let the simulator answer rather than
    // pretending the warehouse is empty.
    if (scoped.length === 0) return null;

    // "live" must mean SAP just confirmed it. Once a fetch fails we serve the
    // last good payload and say so, however recent it is — a reader must never
    // be told "live" while SAP is unreachable.
    const staleFor = this.staleMinutes(live.fetchedAt);
    const dataSource = live.degraded
      ? `sap-iflow (last known good · ${staleFor}m old · SAP unreachable)`
      : 'sap-iflow (live)';

    if (toolName === 'listWarehouseStock') {
      const agg = this.aggregate(scoped);
      return {
        structuredContent: full
          ? { records: agg, rowCount: agg.length, dataSource }
          : { ...this.budget(agg, warehouseId), dataSource },
      };
    }

    if (toolName === 'getStockLevel') {
      const materialId = String(params.materialId ?? '');
      const records = this.aggregate(scoped.filter((r) => r.materialId === materialId));
      return { structuredContent: { records, dataSource } };
    }

    if (toolName === 'getLowStock') {
      const threshold = Number(params.threshold ?? 50);
      const low = this.aggregate(scoped)
        .filter((r) => r.quantity < threshold)
        .sort((a, b) => a.quantity - b.quantity)
        .map((r) => ({ ...r, description: '', inboundQty: 0 }));
      // Low stock is already the interesting subset; keep the smallest first.
      return {
        structuredContent: full
          ? { records: low, rowCount: low.length, dataSource }
          : { ...this.budget(low, warehouseId), dataSource },
      };
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

  /**
   * Goods movements from A_MaterialDocumentItem. The entity exposes no posting
   * timestamp (that lives on the document header), so the `sinceHours` window
   * cannot be honoured — we say so instead of inventing dates or silently
   * returning everything as if it were recent.
   */
  private async serveMovements(
    params: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    const rows = await this.fetchObject('GOODS_MOVEMENT', orgId);
    if (!rows) return null;

    const warehouseId = params.warehouseId ? String(params.warehouseId) : undefined;
    const scoped = warehouseId ? rows.filter((r) => String(r.Plant ?? '') === warehouseId) : rows;
    if (!scoped.length) return null;

    const records = scoped.map((r) => {
      // 'S' debits the location (receipt), 'H' credits it (issue).
      const isReceipt = String(r.DebitCreditCode ?? 'S') === 'S';
      const location = String(r.StorageLocation ?? '') || 'unassigned';
      const counterparty = String(r.IssuingOrReceivingStorageLoc ?? '') || 'external';
      return {
        movementId: `${r.MaterialDocument ?? ''}/${r.MaterialDocumentItem ?? ''}`,
        productId: String(r.Material ?? ''),
        materialId: String(r.Material ?? ''),
        warehouseId: String(r.Plant ?? ''),
        fromLocation: isReceipt ? counterparty : location,
        toLocation: isReceipt ? location : counterparty,
        qty: Math.abs(Number(r.QuantityInBaseUnit ?? 0)),
        unit: String(r.MaterialBaseUnit ?? ''),
        movementType: String(r.GoodsMovementType ?? ''),
        direction: isReceipt ? 'receipt' : 'issue',
        fiscalPeriod: String(r.FiscalYearPeriod ?? r.MaterialDocumentYear ?? ''),
        status: 'confirmed' as const,
      };
    });

    const budgeted = records.length > RESPONSE_ROW_BUDGET ? records.slice(0, RESPONSE_ROW_BUDGET) : records;
    return {
      structuredContent: {
        records: budgeted,
        rowCount: records.length,
        ...(budgeted.length < records.length
          ? { truncated: { shown: budgeted.length, total: records.length } }
          : {}),
        dataSource: 'sap-iflow (live)',
        note:
          `${records.length} goods movements from SAP material documents. This SAP entity does not expose a posting ` +
          `timestamp, so the requested time window was NOT applied — do not describe these as "last 24 hours". ` +
          `Use fiscalPeriod for recency.`,
      },
    };
  }

  /**
   * Purchase orders from A_PurchaseOrder. The customer's iFlow serves the header
   * entity only, so there is no material, plant or quantity per line — the tool
   * reports supplier and dates and is explicit about the missing item detail.
   */
  private async servePurchaseOrders(
    params: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    const rows = await this.fetchObject('PURCHASING', orgId);
    if (!rows) return null;

    const records = rows.map((r) => ({
      poNumber: String(r.PurchaseOrder ?? ''),
      supplier: String(r.Supplier ?? ''),
      companyCode: String(r.CompanyCode ?? ''),
      purchasingGroup: String(r.PurchasingGroup ?? ''),
      purchasingOrganization: String(r.PurchasingOrganization ?? ''),
      orderType: String(r.PurchaseOrderType ?? ''),
      currency: String(r.DocumentCurrency ?? ''),
      orderedAt: String(r.PurchaseOrderDate ?? r.CreationDate ?? ''),
      createdBy: String(r.CreatedByUser ?? ''),
      status: String(r.PurchasingProcessingStatus ?? '') || 'unknown',
    }));

    const warehouseId = params.warehouseId ? String(params.warehouseId) : undefined;

    // Header data has no plant. Prose caveats did not hold — the model still
    // reported these as "plant 1030's open POs" — so a plant-scoped request gets
    // no row list at all. Nothing to tabulate means nothing to misattribute.
    if (warehouseId) {
      return {
        structuredContent: {
          unavailable: true,
          reason:
            `Purchase orders cannot be listed per plant. The connected SAP iFlow serves purchase order ` +
            `HEADERS only, which carry no plant, material or quantity, so there is no way to tell which ` +
            `of them belong to plant ${warehouseId}. Tell the user this plainly and do not list or count ` +
            `purchase orders for this plant. Connecting an A_PurchaseOrderItem iFlow would enable it.`,
          purchaseOrderHeadersAvailableAcrossAllPlants: records.length,
          dataSource: 'sap-iflow (live)',
        },
      };
    }

    const budgeted = records.length > RESPONSE_ROW_BUDGET ? records.slice(0, RESPONSE_ROW_BUDGET) : records;
    return {
      structuredContent: {
        note:
          'These are purchase order HEADERS across all plants — no plant, material or quantity is available, ' +
          'and the status was not filtered, so do not describe them as "open".',
        containsMaterialOrQuantity: false,
        dataSource: 'sap-iflow (live)',
        rowCount: records.length,
        ...(budgeted.length < records.length
          ? { truncated: { shown: budgeted.length, total: records.length } }
          : {}),
        records: budgeted,
      },
    };
  }

  /**
   * Materials, derived from live stock rather than the product master. There is
   * no API_PRODUCT_SRV iFlow connected, so descriptions and material types are
   * genuinely unavailable — the payload says so instead of returning invented
   * text, which is what the simulator would have supplied.
   */
  private async serveMaterials(
    toolName: string,
    params: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    const live = await this.liveStock(orgId);
    if (!live) return null;

    const dataSource = live.degraded
      ? `sap-iflow (last known good · ${this.staleMinutes(live.fetchedAt)}m old · SAP unreachable)`
      : 'sap-iflow (live)';
    const noDescriptions =
      'Material descriptions and material types are not available: no product-master (API_PRODUCT_SRV) ' +
      'iFlow is connected. Report the material IDs as they are and do not invent names for them.';

    if (toolName === 'getMaterialDetails') {
      const materialId = String(params.materialId ?? '');
      const rows = live.rows.filter((r) => r.materialId === materialId);
      if (!rows.length) return null;
      const byPlant: Record<string, number> = {};
      for (const r of rows) byPlant[r.warehouseId] = (byPlant[r.warehouseId] ?? 0) + r.quantity;
      return {
        structuredContent: {
          note: noDescriptions,
          materialId,
          productId: materialId,
          description: null,
          materialType: null,
          totalQuantity: rows.reduce((s, r) => s + r.quantity, 0),
          plants: Object.keys(byPlant).sort(),
          quantityByPlant: byPlant,
          storageLocations: [...new Set(rows.map((r) => r.location))].sort(),
          dataSource,
        },
      };
    }

    // searchMaterials
    const query = String(params.query ?? params.search ?? '').trim().toLowerCase();
    const warehouseId = params.warehouseId ? String(params.warehouseId) : undefined;
    const scoped = warehouseId ? live.rows.filter((r) => r.warehouseId === warehouseId) : live.rows;
    const seen = new Map<string, { materialId: string; plants: Set<string>; quantity: number }>();
    for (const r of scoped) {
      if (query && !r.materialId.toLowerCase().includes(query)) continue;
      const cur = seen.get(r.materialId);
      if (cur) {
        cur.plants.add(r.warehouseId);
        cur.quantity += r.quantity;
      } else {
        seen.set(r.materialId, { materialId: r.materialId, plants: new Set([r.warehouseId]), quantity: r.quantity });
      }
    }
    if (!seen.size) return null;
    const all = [...seen.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .map((m) => ({
        materialId: m.materialId,
        productId: m.materialId,
        description: null,
        plants: [...m.plants].sort(),
        totalQuantity: m.quantity,
      }));
    const shown = all.length > RESPONSE_ROW_BUDGET ? all.slice(0, RESPONSE_ROW_BUDGET) : all;
    return {
      structuredContent: {
        note: noDescriptions,
        records: shown,
        rowCount: all.length,
        ...(shown.length < all.length ? { truncated: { shown: shown.length, total: all.length } } : {}),
        dataSource,
      },
    };
  }

  /**
   * Suppliers, derived from live purchase order headers. Only the SAP supplier
   * IDs exist — names, lead times and on-time rates need a business-partner
   * feed, so they are reported as unavailable rather than filled in.
   */
  private async serveSuppliers(
    orgId?: string | null,
  ): Promise<{ structuredContent: Record<string, unknown> } | null> {
    const rows = await this.fetchObject('PURCHASING', orgId);
    if (!rows) return null;

    const counts = new Map<string, number>();
    for (const r of rows) {
      const id = String(r.Supplier ?? '').trim();
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    if (!counts.size) return null;

    const records = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([supplierId, purchaseOrderCount]) => ({
        supplierId,
        name: null,
        leadTimeDays: null,
        onTimeRate: null,
        purchaseOrderCount,
      }));
    return {
      structuredContent: {
        note:
          'Supplier IDs come from live SAP purchase order headers. Names, lead times and on-time rates are ' +
          'NOT available — no business-partner feed is connected. Do not invent supplier names; use the IDs.',
        records: records.slice(0, RESPONSE_ROW_BUDGET),
        rowCount: records.length,
        dataSource: 'sap-iflow (live)',
      },
    };
  }

  /**
   * Cap the rows sent to the model, but never silently: the payload carries the
   * true totals and says how many rows were withheld, so an aggregate answer
   * ("how much stock in total") stays correct on a truncated list.
   */
  private budget<T extends { quantity: number; location: string; materialId: string }>(
    rows: T[],
    warehouseId?: string,
  ): Record<string, unknown> {
    const total = rows.length;
    if (total <= RESPONSE_ROW_BUDGET) {
      return { records: rows, rowCount: total };
    }
    // Keep the largest positions — the ones that matter for stock questions.
    const shown = [...rows].sort((a, b) => b.quantity - a.quantity).slice(0, RESPONSE_ROW_BUDGET);
    const byLocation: Record<string, number> = {};
    for (const r of rows) {
      byLocation[r.location] = (byLocation[r.location] ?? 0) + r.quantity;
    }
    return {
      records: shown,
      rowCount: total,
      truncated: {
        shown: shown.length,
        total,
        withheld: total - shown.length,
        basis: 'largest quantities first',
      },
      totals: {
        warehouseId: warehouseId ?? null,
        distinctMaterials: new Set(rows.map((r) => r.materialId)).size,
        totalQuantity: rows.reduce((sum, r) => sum + r.quantity, 0),
        byLocation,
      },
      note: `Showing ${shown.length} of ${total} positions (largest first). The totals above cover ALL ${total} positions — use them for any aggregate answer.`,
    };
  }

  /** Plants that actually have live stock — used to show what is connected. */
  async livePlants(orgId?: string | null): Promise<string[]> {
    const live = await this.liveStock(orgId);
    if (!live) return [];
    return [...new Set(live.rows.map((r) => r.warehouseId))].sort();
  }
}
