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

function buildServer(): McpServer {
  const mcpServer = new McpServer({ name: 'mcp-warehouse-ops', version: '1.0.0' });

  mcpServer.registerTool(
  'moveStock',
  {
    title: 'Move stock between warehouse locations',
    description: 'Moves product quantity from one location to another in the same warehouse',
    inputSchema: {
      productId: z.string(),
      fromLocation: z.string(),
      toLocation: z.string(),
      // coerce: LLMs frequently pass numerics as strings ("10")
      qty: z.coerce.number().int().positive(),
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
      sinceHours: z.coerce.number().int().positive(),
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

  return mcpServer;
}

// When MCP_SHARED_SECRET is set, only callers presenting it may invoke tools.
app.use('/mcp', (req, res, next) => {
  const secret = process.env.MCP_SHARED_SECRET;
  if (secret && req.headers['x-mcp-secret'] !== secret) {
    res.status(401).json({ error: { code: 'VALIDATION_ERROR', message: 'missing or invalid MCP shared secret' } });
    return;
  }
  next();
});

// Stateless Streamable HTTP: a fresh server + transport per request avoids
// cross-request session and request-id collisions.
app.post('/mcp', async (req, res) => {
  const mcpServer = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void mcpServer.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error({ err: error }, 'MCP request failed');
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'VALIDATION_ERROR', message: 'MCP request failed' } });
    }
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT || 4002);
app.listen(port, () => {
  logger.info({ port }, 'mcp-warehouse-ops started');
});
