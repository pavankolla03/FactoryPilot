import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { IflowState } from './state';
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

export function createApp(state = new IflowState()) {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path, query: req.query }, 'request');
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post('/oauth/token', (_req, res) => {
    res.json({ access_token: 'mock-iflow-token', token_type: 'bearer', expires_in: 3600 });
  });

  app.get('/iflow/materials/:materialId', (req, res) => {
    const item = state.getMaterial(req.params.materialId);
    if (!item) {
      return res.status(404).json(errorResponse('VALIDATION_ERROR', 'material not found'));
    }

    return res.json(item);
  });

  app.get('/iflow/stock', (req, res) => {
    const parsed = stockQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    return res.json({
      records: state.getStock(parsed.data.materialId, parsed.data.warehouseId),
    });
  });

  app.get('/iflow/movements', (req, res) => {
    const parsed = movementQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    return res.json({
      records: state.getMovements(parsed.data.warehouseId, parsed.data.sinceHours),
    });
  });

  app.get('/iflow/summary', (req, res) => {
    const warehouseId = String(req.query.warehouseId || '');
    if (!warehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'warehouseId is required'));
    }
    return res.json(state.getWarehouseSummary(warehouseId));
  });

  app.get('/iflow/materials-search', (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'q is required'));
    }
    return res.json({ records: state.searchMaterials(query) });
  });

  app.get('/iflow/low-stock', (req, res) => {
    const warehouseId = String(req.query.warehouseId || '');
    if (!warehouseId) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', 'warehouseId is required'));
    }
    const threshold = Number(req.query.threshold || 50);
    return res.json({ records: state.getLowStock(warehouseId, threshold) });
  });

  app.get('/iflow/purchase-orders', (req, res) => {
    const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;
    return res.json({ records: state.getPurchaseOrders(warehouseId, status) });
  });

  app.post('/iflow/move', (req, res) => {
    const parsed = moveBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse('VALIDATION_ERROR', parsed.error.message));
    }

    try {
      const movement = state.moveStock(parsed.data);
      return res.json({ success: true, movement });
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
