import express from 'express';
import pino from 'pino';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { iflowGet } from './iflow-client.js';

const logger = pino({ name: 'mcp-inventory', level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(express.json());

const mcpServer = new McpServer({ name: 'mcp-inventory', version: '1.0.0' });

async function handleGetStockLevel(materialId: string, warehouseId: string) {
  return iflowGet('/iflow/stock', { materialId, warehouseId });
}

async function handleListWarehouseStock(warehouseId: string) {
  return iflowGet('/iflow/stock', { warehouseId });
}

async function handleGetMaterialDetails(materialId: string) {
  return iflowGet(`/iflow/materials/${encodeURIComponent(materialId)}`, {});
}

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
        name: 'getStockLevel',
        description: 'Returns stock records for a single material in a warehouse',
        inputSchema: {
          type: 'object',
          properties: {
            materialId: { type: 'string' },
            warehouseId: { type: 'string' },
          },
          required: ['materialId', 'warehouseId'],
        },
      },
      {
        name: 'listWarehouseStock',
        description: 'Returns all stock records for a warehouse',
        inputSchema: {
          type: 'object',
          properties: {
            warehouseId: { type: 'string' },
          },
          required: ['warehouseId'],
        },
      },
      {
        name: 'getMaterialDetails',
        description: 'Returns material master data that is not warehouse-scoped',
        inputSchema: {
          type: 'object',
          properties: {
            materialId: { type: 'string' },
          },
          required: ['materialId'],
        },
      },
    ],
  });
});

app.post('/tools/call', async (req, res) => {
  const name = req.body?.name as string;
  const args = (req.body?.arguments || {}) as Record<string, unknown>;

  try {
    if (name === 'getStockLevel') {
      const result = await handleGetStockLevel(String(args.materialId), String(args.warehouseId));
      return res.json({ structuredContent: result });
    }

    if (name === 'listWarehouseStock') {
      const result = await handleListWarehouseStock(String(args.warehouseId));
      return res.json({ structuredContent: result });
    }

    if (name === 'getMaterialDetails') {
      const result = await handleGetMaterialDetails(String(args.materialId));
      return res.json({ structuredContent: result });
    }

    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown tool ${name}` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool call failed';
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
  }
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const port = Number(process.env.PORT || 4001);
app.listen(port, () => {
  logger.info({ port }, 'mcp-inventory started');
});
