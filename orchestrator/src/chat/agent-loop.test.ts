import { describe, expect, it } from 'vitest';
import { ChatService } from './chat.service';
import type { DbService } from '../common/db.service';
import type { RedisService } from '../common/redis.service';
import type { LlmProviderFactory } from '../llm/provider.factory';
import type { LlmChatMessage, LlmCompletionResult } from '../llm/types';
import type { McpService } from '../mcp/mcp.service';
import type { QuotaService } from '../quota/quota.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { AlertsService } from '../alerts/alerts.service';
import type { AgentsService } from '../agents/agents.service';
import type { BusinessObjectsService } from '../business-objects/business-objects.service';
import type { HealthService } from '../health/health.service';
import type { SuppliersService } from '../suppliers/suppliers.service';
import type { SlottingService } from '../slotting/slotting.service';
import type { AuthUser } from '../common/types';

interface StoredMessage {
  role: string;
  content: string;
  tool_calls_json: unknown;
  created_at: number;
}

function buildFakes() {
  const messages: StoredMessage[] = [];
  const sessionLogs: Array<Record<string, unknown>> = [];
  let clock = 0;

  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO conversations')) {
        return { rows: [{ id: 'conv-1' }] };
      }
      if (sql.includes('INSERT INTO conversation_messages')) {
        messages.push({
          role: params[1] as string,
          content: params[2] as string,
          tool_calls_json: params[3] ? JSON.parse(params[3] as string) : null,
          created_at: (clock += 1),
        });
        return { rows: [] };
      }
      if (sql.includes('FROM conversation_messages')) {
        return { rows: [...messages].sort((a, b) => a.created_at - b.created_at) };
      }
      if (sql.includes('INSERT INTO session_logs')) {
        const row = { user_id: params[0], tokens_used: params[5], status: params[6] };
        sessionLogs.push(row);
        return { rows: [row] };
      }
      return { rows: [] };
    },
  } as unknown as DbService;

  const redisStore = new Map<string, string>();
  const redis = {
    raw: {
      get: async (k: string) => redisStore.get(k) ?? null,
      setEx: async (k: string, _ttl: number, v: string) => void redisStore.set(k, v),
      getDel: async (k: string) => {
        const v = redisStore.get(k) ?? null;
        redisStore.delete(k);
        return v;
      },
      hIncrBy: async () => 1,
    },
  } as unknown as RedisService;

  const providerRounds: LlmChatMessage[][] = [];
  const completions: LlmCompletionResult[] = [
    {
      text: '',
      toolCalls: [{ id: 'call_1', name: 'getStockLevel', arguments: { materialId: 'MAT-1', warehouseId: '1010' } }],
      promptTokens: 100,
      completionTokens: 20,
      modelUsed: 'fake',
    },
    {
      text: 'You have 42 units in warehouse 1010.',
      promptTokens: 150,
      completionTokens: 30,
      modelUsed: 'fake',
    },
  ];
  let round = 0;
  const providerFactory = {
    getProviderForUser: (_userId: string, _models: unknown[]) => providerFactory.getProvider(),
    getProvider: () => ({
      complete: async (msgs: LlmChatMessage[]) => {
        providerRounds.push(JSON.parse(JSON.stringify(msgs)));
        return completions[round++];
      },
    }),
  } as unknown as LlmProviderFactory;

  const mcp = {
    listTools: () => [
      {
        name: 'getStockLevel',
        description: 'stock',
        inputSchema: { type: 'object', properties: { materialId: {}, warehouseId: {} } },
        serverName: 'inventory',
      },
    ],
    getTool: (name: string) =>
      name === 'getStockLevel'
        ? {
            name,
            description: 'stock',
            inputSchema: { type: 'object', properties: { materialId: {}, warehouseId: {} } },
            serverName: 'inventory',
          }
        : undefined,
    callTool: async () => ({ structuredContent: { qty: 42 } }),
  } as unknown as McpService;

  const quota = {
    isExceeded: async () => ({ exceeded: false, snapshot: { used: 0, limit: 50000, periodStart: '2026-07-01' } }),
    recordUsage: async () => undefined,
    getUsage: async () => ({ used: 300, limit: 50000, periodStart: '2026-07-01' }),
  } as unknown as QuotaService;

  const realtime = {
    emitTokenDelta: () => undefined,
    emitChatToken: () => undefined,
    emitChatDone: () => undefined,
    emitChatStatus: () => undefined,
    emitPendingAction: () => undefined,
    emitSessionLog: () => undefined,
  } as unknown as RealtimeGateway;

  const alerts = {
    createAlert: async () => ({ id: 'a1', warehouse_id: '1010', material_id: 'MAT-1', threshold: 10 }),
    listAlerts: async () => [],
  } as unknown as AlertsService;

  const agentsSvc = {
    createGoal: async () => ({ id: 'g1', warehouse_id: '1010', threshold: 50, autonomy: 'propose', daily_budget_qty: 200 }),
    listGoals: async () => [],
    listRuns: async () => [],
    startRun: async () => ({ runId: 'r1' }),
    onActionExecuted: async () => undefined,
    recallEpisodes: async () => [],
    announceApproval: async () => undefined,
  } as unknown as AgentsService;

  const businessObjects = {
    activeObjects: async () => [],
    query: async () => ({ objectCode: '', objectName: '', dataSource: 'simulator', records: [] }),
  } as unknown as BusinessObjectsService;

  const health = {
    detail: async () => ({ warehouseId: '1010', score: 90, band: 'healthy', trend: null, detractor: null, factors: [], computedAt: '' }),
    overview: async () => [],
  } as unknown as HealthService;

  const suppliers = {
    scorecards: async () => [],
    leadTimeFor: async () => null,
  } as unknown as SuppliersService;

  const slotting = {
    proposals: async () => ({ warehouseId: '1010', window: '7 days', proposals: [] }),
  } as unknown as SlottingService;

  return {
    db,
    redis,
    providerFactory,
    mcp,
    quota,
    realtime,
    alerts,
    agentsSvc,
    businessObjects,
    health,
    suppliers,
    slotting,
    providerRounds,
    sessionLogs,
    messages,
  };
}

const user: AuthUser = {
  id: 'user-1',
  email: 'u@test.com',
  displayName: 'U',
  role: 'admin',
  scopes: [],
};

describe('agent loop', () => {
  it('feeds the assistant tool-call turn and tool result back into round 2', async () => {
    const fakes = buildFakes();
    const service = new ChatService(
      fakes.db,
      fakes.redis,
      fakes.providerFactory,
      fakes.mcp,
      fakes.quota,
      fakes.realtime,
      fakes.alerts,
      fakes.agentsSvc,
      fakes.businessObjects,
      fakes.health,
      fakes.suppliers,
      fakes.slotting,
    );

    const response = await service.chat(user, undefined, 'how much MAT-1 in 1010?');

    expect(response.text).toBe('You have 42 units in warehouse 1010.');
    expect(fakes.providerRounds).toHaveLength(2);

    const round2 = fakes.providerRounds[1];
    const assistantTurn = round2.find((m) => m.role === 'assistant' && m.toolCalls?.length);
    expect(assistantTurn?.toolCalls?.[0].id).toBe('call_1');

    const toolTurn = round2.find((m) => m.role === 'tool');
    expect(toolTurn?.toolCallId).toBe('call_1');
    expect(toolTurn?.content).toContain('42');

    const assistantIdx = round2.indexOf(assistantTurn!);
    const toolIdx = round2.indexOf(toolTurn!);
    expect(toolIdx).toBe(assistantIdx + 1);
  });

  it('accumulates tokens across rounds into the session log and persists tool turns', async () => {
    const fakes = buildFakes();
    const service = new ChatService(
      fakes.db,
      fakes.redis,
      fakes.providerFactory,
      fakes.mcp,
      fakes.quota,
      fakes.realtime,
      fakes.alerts,
      fakes.agentsSvc,
      fakes.businessObjects,
      fakes.health,
      fakes.suppliers,
      fakes.slotting,
    );

    await service.chat(user, undefined, 'how much MAT-1 in 1010?');

    expect(fakes.sessionLogs).toHaveLength(1);
    expect(fakes.sessionLogs[0].tokens_used).toBe(300);

    const roles = fakes.messages.map((m) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant']);
  });
});
