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
        ? await fetchLivePurchaseOrders(warehouseId)
        : state.getPurchaseOrders(warehouseId, status);
      if (sapLiveEnabled() && status) {
        records = records.filter((r) => r.status === status);
      }
      return res.json({ records, dataSource: dataSource() });
    } catch (err) {
      return res.status(502).json(errorResponse('VALIDATION_ERROR', err instanceof Error ? err.message : 'SAP error'));
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
