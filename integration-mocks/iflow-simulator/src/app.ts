import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { IflowState } from './state';
import { WriteLedger } from './ledger';
import {
  fetchLiveMaterial,
  fetchLivePurchaseOrders,
  fetchLiveStock,
  sapLiveEnabled,
  searchLiveMaterials,
} from './sap-live';
import type { ApiErrorShape } from './types';

const logger = pino({ name: 'iflow-simulator', level: process.env.LOG_LEVEL || 'info' });

const stockQuerySchema = z.object({
  materialId: z.string().optional(),
  warehouseId: z.string().optional(),
});

const movementQuerySchema = z.object({
  warehouseId: z.string().min(1),
  sinceHours: z.coerce.number().int().min(1).max(720).default(24),
});

const moveBodySchema = z.object({
  productId: z.string().min(1),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
  qty: z.number().int().positive(),
  warehouseId: z.string().min(1),
});

function errorResponse(code: ApiErrorShape['error']['code'], message: string): ApiErrorShape {
  return { error: { code, message } };
}

function dataSource(): 'sap-sandbox' | 'simulator' {
  return sapLiveEnabled() ? 'sap-sandbox' : 'simulator';
}

export function createApp(state = new IflowState(), ledger = new WriteLedger()) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path, query: req.query, mode: dataSource() }, 'request');
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', mode: dataSource() });
  });

  app.post('/oauth/token', (_req, res) => {
    res.json({ access_token: 'mock-iflow-token', token_type: 'bearer', expires_in: 3600 });
  });

  const getStockRecords = async (materialId?: string, warehouseId?: string) => {
    if (sapLiveEnabled()) {
      const live = await fetchLiveStock(materialId, warehouseId);
      return ledger.applyDeltas(live);
    }
    return state.getStock(materialId, warehouseId);
  };

  app.get('/iflow/materials/:materialId', async (req, res) => {
    try {
      const item = sapLiveEnabled()
        ? await fetchLiveMaterial(req.params.materialId)
        : state.getMaterial(req.params.materialId);
      if (!item) {
        return res.status(404).json(errorResponse('VALIDATION_ERROR', 'material not found'));
      }
      return res.json({ ...item, dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/stock', async (req, res) => {
    const parsed = stockQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    try {
      const records = await getStockRecords(parsed.data.materialId, parsed.data.warehouseId);
      return res.json({ records, dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/movements', (req, res) => {
    const parsed = movementQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    const records = sapLiveEnabled()
      ? ledger.getMovements(parsed.data.warehouseId, parsed.data.sinceHours)
      : state.getMovements(parsed.data.warehouseId, parsed.data.sinceHours);
    return res.json({ records, dataSource: sapLiveEnabled() ? 'write-ledger' : 'simulator' });
  });

  app.get('/iflow/summary', async (req, res) => {
    const warehouseId = String(req.query.warehouseId || '');
    if (!warehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'warehouseId is required'));
    }

    try {
      if (sapLiveEnabled()) {
        const [stocks, pos] = await Promise.all([
          getStockRecords(undefined, warehouseId),
          fetchLivePurchaseOrders(warehouseId).catch(() => []),
        ]);
        const byLocation: Record<string, number> = {};
        for (const s of stocks) {
          byLocation[s.location] = (byLocation[s.location] || 0) + s.quantity;
        }
        return res.json({
          warehouseId,
          distinctMaterials: new Set(stocks.map((s) => s.materialId)).size,
          totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
          byLocation,
          movementsLast24h: ledger.getMovements(warehouseId, 24).length,
          openPurchaseOrders: pos.filter((p) => p.status !== 'delivered').length,
          dataSource: dataSource(),
        });
      }
      return res.json({ ...state.getWarehouseSummary(warehouseId), dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/materials-search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'q is required'));
    }
    try {
      const records = sapLiveEnabled() ? await searchLiveMaterials(query) : state.searchMaterials(query);
      return res.json({ records, dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/low-stock', async (req, res) => {
    const warehouseId = String(req.query.warehouseId || '');
    if (!warehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'warehouseId is required'));
    }
    const threshold = Number(req.query.threshold || 50);

    try {
      if (sapLiveEnabled()) {
        const stocks = await getStockRecords(undefined, warehouseId);
        const records = stocks
          .filter((s) => s.quantity < threshold)
          .sort((a, b) => a.quantity - b.quantity)
          .map((s) => ({ ...s, description: '', inboundQty: 0 }));
        return res.json({ records, dataSource: dataSource() });
      }
      return res.json({ records: state.getLowStock(warehouseId, threshold), dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/purchase-orders', async (req, res) => {
    const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    try {
      let records = sapLiveEnabled()
        ? (await fetchLivePurchaseOrders(warehouseId)).map((po) =>
            ledger.receivedPOs.includes(po.poNumber) ? { ...po, status: 'delivered' as const } : po,
          )
        : state.getPurchaseOrders(warehouseId, status);
      if (sapLiveEnabled() && status) {
        records = records.filter((r) => r.status === status);
      }
      return res.json({ records, dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
    }
  });

  app.get('/iflow/demand-trend', (req, res) => {
    const warehouseId = String(req.query.warehouseId || '');
    if (!warehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'warehouseId is required'));
    }
    const days = Math.min(Number(req.query.days || 14), 90);
    const byProduct = req.query.byProduct === '1' || req.query.byProduct === 'true';
    const records = sapLiveEnabled()
      ? ledger.getDemandTrend(warehouseId, days)
      : state.getDemandTrend(warehouseId, days, byProduct);
    return res.json({ records, dataSource: sapLiveEnabled() ? 'write-ledger' : 'simulator' });
  });

  app.post('/iflow/transfer', (req, res) => {
    const parsed = z
      .object({
        productId: z.string().min(1),
        fromWarehouseId: z.string().min(1),
        toWarehouseId: z.string().min(1),
        qty: z.number().int().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }
    if (parsed.data.fromWarehouseId === parsed.data.toWarehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'source and destination warehouses must differ'));
    }
    try {
      const result = state.transferStock(parsed.data);
      return res.json({ success: true, transfer: result, dataSource: 'simulator' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'transfer failed';
      const status = message.startsWith('INSUFFICIENT_STOCK') ? 409 : 500;
      return res.status(status).json(errorResponse(status === 409 ? 'INSUFFICIENT_STOCK' : 'VALIDATION_ERROR', message));
    }
  });

  app.get('/iflow/production-orders', (req, res) => {
    const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    const records = state.productionOrders.filter(
      (po) => (!warehouseId || po.warehouseId === warehouseId) && (!status || po.status === status),
    );
    return res.json({ records, dataSource: 'simulator' });
  });

  app.get('/iflow/suppliers', (_req, res) => {
    return res.json({ records: state.suppliers, dataSource: 'simulator' });
  });

  app.get('/iflow/purchase-requisitions', (req, res) => {
    const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
    const records = ledger.purchaseRequisitions.filter((pr) => !warehouseId || pr.warehouseId === warehouseId);
    return res.json({ records, dataSource: 'write-ledger' });
  });

  app.post('/iflow/purchase-requisition', (req, res) => {
    const parsed = z
      .object({
        materialId: z.string().min(1),
        warehouseId: z.string().min(1),
        qty: z.number().int().positive(),
        note: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }
    const pr = ledger.createPurchaseRequisition(parsed.data);
    return res.json({ success: true, purchaseRequisition: pr, dataSource: 'write-ledger' });
  });

  app.post('/iflow/goods-receipt', async (req, res) => {
    const parsed = z.object({ poNumber: z.string().min(1), warehouseId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    try {
      if (sapLiveEnabled()) {
        const pos = await fetchLivePurchaseOrders(parsed.data.warehouseId);
        const po = pos.find((p) => p.poNumber === parsed.data.poNumber);
        if (!po) {
          return res.status(404).json(errorResponse('VALIDATION_ERROR', `purchase order ${parsed.data.poNumber} not found`));
        }
        const result = ledger.receivePurchaseOrder(po);
        return res.json({ success: true, ...result, dataSource: 'write-ledger' });
      }
      const result = state.receivePurchaseOrder(parsed.data.poNumber);
      return res.json({ success: true, ...result, dataSource: 'simulator' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return res.status(400).json(errorResponse('VALIDATION_ERROR', message));
    }
  });

  app.post('/iflow/adjust', async (req, res) => {
    const parsed = z
      .object({
        productId: z.string().min(1),
        warehouseId: z.string().min(1),
        location: z.string().min(1),
        targetQty: z.number().int().min(0),
        reason: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    try {
      if (sapLiveEnabled()) {
        const live = await fetchLiveStock(undefined, parsed.data.warehouseId);
        const result = ledger.adjustStock(live, parsed.data);
        return res.json({ success: true, ...result, dataSource: 'write-ledger' });
      }
      const result = state.adjustStock(parsed.data);
      return res.json({ success: true, ...result, dataSource: 'simulator' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return res.status(400).json(errorResponse('VALIDATION_ERROR', message));
    }
  });

  app.post('/iflow/move', async (req, res) => {
    const parsed = moveBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    try {
      if (sapLiveEnabled()) {
        // SAP's public sandbox is read-only: validate against live stock, then
        // record the movement in the write ledger (applied as a delta on reads).
        const live = await fetchLiveStock(undefined, parsed.data.warehouseId);
        const movement = ledger.moveStock(live, parsed.data);
        return res.json({ success: true, movement, dataSource: 'write-ledger' });
      }
      const movement = state.moveStock(parsed.data);
      return res.json({ success: true, movement, dataSource: 'simulator' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      if (message.startsWith('INSUFFICIENT_STOCK')) {
        return res.status(400).json(errorResponse('INSUFFICIENT_STOCK', message));
      }
      return res.status(400).json(errorResponse('VALIDATION_ERROR', message));
    }
  });

  return app;
}
