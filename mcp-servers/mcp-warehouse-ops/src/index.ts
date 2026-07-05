import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { createClient } from 'redis';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { iflowGet, iflowPost } from './iflow-client.js';
import { movementCacheKey, movementScoreWindow } from './movements-cache.js';

const logger = pino({ name: 'mcp-warehouse-ops', level: process.env.LOG_LEVEL || 'info' });

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is required');
}

const redis = createClient({ url: redisUrl });
await redis.connect();

const app = express();
app.use(express.json());

const mcpServer = new McpServer({ name: 'mcp-warehouse-ops', version: '1.0.0' });

async function handleMoveStock(input: {
  productId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
  warehouseId: string;
}) {
  return iflowPost('/iflow/move', input);
}

async function handleGetRecentMovements(warehouseId: string, sinceHours: number) {
  const key = movementCacheKey(warehouseId);
  const { min: minScore, max: now } = movementScoreWindow(sinceHours);

  const cached = await redis.zRangeByScore(key, minScore, now);

  if (cached.length > 0) {
    const records = cached.map((item) => JSON.parse(item));
    return { source: 'cache', records };
  }

  const fallback = await iflowGet('/iflow/movements', { warehouseId, sinceHours });
  const records = fallback.records ?? [];

  if (records.length > 0) {
    const tx = redis.multi();
    for (const record of records) {
      const score = new Date(record.timestamp).getTime();
      tx.zAdd(key, { score, value: JSON.stringify(record) });
    }
    await tx.exec();
  }

  return { source: 'live', records };
}

mcpServer.registerTool(
  'moveStock',
  {
    title: 'Move stock between warehouse locations',
    description: 'Moves product quantity from one location to another in the same warehouse',
    inputSchema: {
      productId: z.string(),
      fromLocation: z.string(),
      toLocation: z.string(),
      qty: z.number().int().positive(),
      warehouseId: z.string(),
    },
  },
  async (input) => {
    const result = await handleMoveStock(input);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);

mcpServer.registerTool(
  'getRecentMovements',
  {
    title: 'Get recent warehouse movements',
    description: 'Reads cached movements from Redis sorted set and falls back to iFlow on cold start',
    inputSchema: {
      warehouseId: z.string(),
      sinceHours: z.number().int().positive(),
    },
  },
  async ({ warehouseId, sinceHours }) => {
    const result = await handleGetRecentMovements(warehouseId, sinceHours);

    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

await mcpServer.connect(transport);

app.post('/mcp', async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

app.get('/tools/list', (_req, res) => {
  res.json({
    tools: [
      {
        name: 'moveStock',
        description: 'Moves product quantity from one location to another in the same warehouse',
        inputSchema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            fromLocation: { type: 'string' },
            toLocation: { type: 'string' },
            qty: { type: 'number' },
            warehouseId: { type: 'string' },
          },
          required: ['productId', 'fromLocation', 'toLocation', 'qty', 'warehouseId'],
        },
      },
      {
        name: 'getRecentMovements',
        description: 'Reads cached movements from Redis sorted set and falls back to iFlow on cold start',
        inputSchema: {
          type: 'object',
          properties: {
            warehouseId: { type: 'string' },
            sinceHours: { type: 'number' },
          },
          required: ['warehouseId', 'sinceHours'],
        },
      },
    ],
  });
});

app.post('/tools/call', async (req, res) => {
  const name = req.body?.name as string;
  const args = (req.body?.arguments || {}) as Record<string, unknown>;

  try {
    if (name === 'moveStock') {
      const result = await handleMoveStock({
        productId: String(args.productId),
        fromLocation: String(args.fromLocation),
        toLocation: String(args.toLocation),
        qty: Number(args.qty),
        warehouseId: String(args.warehouseId),
      });
      return res.json({ structuredContent: result });
    }

    if (name === 'getRecentMovements') {
      const result = await handleGetRecentMovements(String(args.warehouseId), Number(args.sinceHours));
      return res.json({ structuredContent: result });
    }

    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown tool ${name}` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool call failed';
    if (message.includes('INSUFFICIENT_STOCK')) {
      return res.status(400).json({ error: { code: 'INSUFFICIENT_STOCK', message } });
    }
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT || 4002);
app.listen(port, () => {
  logger.info({ port }, 'mcp-warehouse-ops started');
});
