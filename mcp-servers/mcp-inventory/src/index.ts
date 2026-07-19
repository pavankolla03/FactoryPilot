import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { iflowGet } from './iflow-client.js';

const logger = pino({ name: 'mcp-inventory', level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(express.json());

async function handleGetStockLevel(materialId: string, warehouseId: string) {
  return iflowGet('/iflow/stock', { materialId, warehouseId });
}

async function handleListWarehouseStock(warehouseId: string) {
  return iflowGet('/iflow/stock', { warehouseId });
}

async function handleGetMaterialDetails(materialId: string) {
  return iflowGet(`/iflow/materials/${encodeURIComponent(materialId)}`, {});
}

function buildServer(): McpServer {
  const mcpServer = new McpServer({ name: 'mcp-inventory', version: '1.0.0' });

  mcpServer.registerTool(
    'getStockLevel',
    {
      title: 'Get stock level for a material in a warehouse',
      description: 'Returns stock records for a single material in a warehouse',
      inputSchema: {
        materialId: z.string(),
        warehouseId: z.string(),
      },
    },
    async ({ materialId, warehouseId }) => {
      const result = await handleGetStockLevel(materialId, warehouseId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'listWarehouseStock',
    {
      title: 'List stock for a warehouse',
      description: 'Returns all stock records for a warehouse',
      inputSchema: {
        warehouseId: z.string(),
      },
    },
    async ({ warehouseId }) => {
      const result = await handleListWarehouseStock(warehouseId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getMaterialDetails',
    {
      title: 'Get global material details',
      description: 'Returns material master data that is not warehouse-scoped',
      inputSchema: {
        materialId: z.string(),
      },
    },
    async ({ materialId }) => {
      const result = await handleGetMaterialDetails(materialId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getWarehouseSummary',
    {
      title: 'Get a warehouse overview',
      description:
        'Returns an aggregate summary for a warehouse: distinct materials, total quantity, quantity by location, movements in the last 24h, open purchase orders',
      inputSchema: {
        warehouseId: z.string(),
      },
    },
    async ({ warehouseId }) => {
      const result = await iflowGet('/iflow/summary', { warehouseId });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'searchMaterials',
    {
      title: 'Search the material master',
      description:
        'Searches materials by id, product id, description text, or material type (FERT/HALB/ROH). Global material master data, not warehouse-scoped. Returns each match with its total stock across all warehouses.',
      inputSchema: {
        query: z.string(),
      },
    },
    async ({ query }) => {
      const result = await iflowGet('/iflow/materials-search', { q: query });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getLowStock',
    {
      title: 'List low-stock positions in a warehouse',
      description:
        'Returns stock positions below a quantity threshold (default 50) in a warehouse, including inbound purchase-order quantity for each material',
      inputSchema: {
        warehouseId: z.string(),
        threshold: z.coerce.number().int().positive().optional(),
      },
    },
    async ({ warehouseId, threshold }) => {
      const result = await iflowGet('/iflow/low-stock', { warehouseId, threshold });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getPurchaseOrders',
    {
      title: 'List purchase orders for a warehouse',
      description:
        'Returns purchase orders for a warehouse, optionally filtered by status (open, in_transit, delivered), with supplier and expected delivery dates',
      inputSchema: {
        warehouseId: z.string(),
        status: z.enum(['open', 'in_transit', 'delivered']).optional(),
      },
    },
    async ({ warehouseId, status }) => {
      const result = await iflowGet('/iflow/purchase-orders', { warehouseId, status });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getProductionOrders',
    {
      title: 'List production orders for a warehouse',
      description:
        'Returns production orders (planned, in_progress, completed) with planned vs confirmed quantities, work center, and start/end dates',
      inputSchema: {
        warehouseId: z.string(),
        status: z.enum(['planned', 'in_progress', 'completed']).optional(),
      },
    },
    async ({ warehouseId, status }) => {
      const result = await iflowGet('/iflow/production-orders', { warehouseId, status });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  mcpServer.registerTool(
    'getSuppliers',
    {
      title: 'List supplier master data',
      description:
        'Returns supplier master records with lead time in days, on-time delivery rate, location, and contact — useful for judging reorder urgency and chasing overdue POs',
      inputSchema: {},
    },
    async () => {
      const result = await iflowGet('/iflow/suppliers', {});
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

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  logger.info({ port }, 'mcp-inventory started');
});
