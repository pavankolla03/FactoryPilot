import pino from 'pino';
import type { Material, PurchaseOrder, StockRecord } from './types';

const logger = pino({ name: 'sap-live', level: process.env.LOG_LEVEL || 'info' });

const SAP_BASE = process.env.SAP_SANDBOX_BASE_URL || 'https://sandbox.api.sap.com/s4hanacloud';

export function sapLiveEnabled(): boolean {
  return Boolean(process.env.SAP_API_KEY);
}

async function sapGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${SAP_BASE}${path}`);
  url.searchParams.set('$format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    headers: {
      APIKey: process.env.SAP_API_KEY as string,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    logger.warn({ status: res.status, path, body: body.slice(0, 300) }, 'SAP sandbox request failed');
    if (res.status === 401 || res.status === 403) {
      throw new Error(`SAP sandbox rejected the API key (${res.status}) — check SAP_API_KEY`);
    }
    if (res.status === 429) {
      throw new Error('SAP sandbox rate limit hit (429) — try again shortly');
    }
    throw new Error(`SAP sandbox request failed with ${res.status}`);
  }

  return res.json();
}

function odataRows(body: unknown): Array<Record<string, unknown>> {
  const d = (body as { d?: { results?: unknown } }).d;
  if (Array.isArray(d?.results)) {
    return d.results as Array<Record<string, unknown>>;
  }
  if (d && typeof d === 'object' && !('results' in d)) {
    return [d as Record<string, unknown>];
  }
  return [];
}

function odataDate(value: unknown): string {
  const match = /\/Date\((\d+)\)\//.exec(String(value ?? ''));
  return match ? new Date(Number(match[1])).toISOString().slice(0, 10) : '';
}

/** Material Stock — Read (API_MATERIAL_STOCK_SRV). Plant maps to warehouseId. */
export async function fetchLiveStock(materialId?: string, warehouseId?: string): Promise<StockRecord[]> {
  const filters: string[] = [];
  if (materialId) {
    filters.push(`Material eq '${materialId}'`);
  }
  if (warehouseId) {
    filters.push(`Plant eq '${warehouseId}'`);
  }

  const body = await sapGet('/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod', {
    ...(filters.length ? { $filter: filters.join(' and ') } : {}),
    $top: '200',
  });

  return odataRows(body)
    .map((row) => ({
      materialId: String(row.Material || ''),
      productId: String(row.Material || ''),
      warehouseId: String(row.Plant || ''),
      location: String(row.StorageLocation || 'unassigned'),
      quantity: Number(row.MatlWrhsStkQtyInMatlBaseUnit || 0),
    }))
    .filter((r) => r.materialId && r.warehouseId);
}

/** Product Master — Read (API_PRODUCT_SRV). */
export async function fetchLiveMaterial(materialId: string): Promise<Material | null> {
  try {
    const body = await sapGet(`/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product('${materialId}')`, {
      $expand: 'to_Description',
    });
    const rows = odataRows(body);
    const row = rows[0];
    if (!row) {
      return null;
    }
    const descriptions = ((row.to_Description as { results?: Array<Record<string, unknown>> })?.results ||
      []) as Array<Record<string, unknown>>;
    const en = descriptions.find((d) => d.Language === 'EN') || descriptions[0];
    return {
      materialId: String(row.Product || materialId),
      productId: String(row.Product || materialId),
      description: String(en?.ProductDescription || ''),
      baseUom: String(row.BaseUnit || ''),
      materialType: String(row.ProductType || ''),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason.includes('404')) {
      return null;
    }
    throw error;
  }
}

/** Product description search (API_PRODUCT_SRV/A_ProductDescription). */
export async function searchLiveMaterials(query: string): Promise<Array<Material & { totalStock: number | null }>> {
  const safe = query.replace(/'/g, "''");
  const body = await sapGet('/sap/opu/odata/sap/API_PRODUCT_SRV/A_ProductDescription', {
    $filter: `substringof('${safe}', ProductDescription) and Language eq 'EN'`,
    $top: '20',
  });

  return odataRows(body).map((row) => ({
    materialId: String(row.Product || ''),
    productId: String(row.Product || ''),
    description: String(row.ProductDescription || ''),
    baseUom: '',
    materialType: '',
    totalStock: null,
  }));
}

/** Purchase Orders — Read (API_PURCHASEORDER_PROCESS_SRV). */
export async function fetchLivePurchaseOrders(warehouseId?: string): Promise<PurchaseOrder[]> {
  const body = await sapGet('/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrderItem', {
    ...(warehouseId ? { $filter: `Plant eq '${warehouseId}'` } : {}),
    $expand: 'to_PurchaseOrder',
    $top: '30',
  });

  return odataRows(body).map((row) => {
    const header = (row.to_PurchaseOrder || {}) as Record<string, unknown>;
    return {
      poNumber: String(row.PurchaseOrder || ''),
      materialId: String(row.Material || ''),
      productId: String(row.Material || ''),
      warehouseId: String(row.Plant || ''),
      qty: Number(row.OrderQuantity || 0),
      supplier: String(header.Supplier || row.SupplierMaterialNumber || 'unknown'),
      status: row.PurchasingDocumentDeletionCode ? 'delivered' : 'open',
      orderedAt: odataDate(header.CreationDate),
      expectedDelivery: '',
    } as PurchaseOrder;
  });
}
