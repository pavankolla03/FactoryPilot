import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ChatResponse, PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';
import { DbService } from '../common/db.service';
import { actionExpired, quotaExceeded, scopeDenied } from '../common/errors';
import type { AuthUser } from '../common/types';
import { LlmProviderFactory } from '../llm/provider.factory';
import type { LlmChatMessage } from '../llm/types';
import { McpService } from '../mcp/mcp.service';
import { QuotaService } from '../quota/quota.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../common/redis.service';

const WRITE_TOOLS = new Set(['moveStock']);

@Injectable()
export class ChatService {
  private readonly cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS || 8640000);

  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly providerFactory: LlmProviderFactory,
    private readonly mcp: McpService,
    private readonly quota: QuotaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getUsage(userId: string) {
    return this.quota.getUsage(userId);
  }

  async chat(user: AuthUser, conversationId: string | undefined, message: string): Promise<ChatResponse> {
    const start = Date.now();
    const quotaState = await this.quota.isExceeded(user.id);
    if (quotaState.exceeded) {
      await this.writeSessionLog({
        userId: user.id,
        conversationId: conversationId ?? null,
        queryText: message,
        toolsInvoked: [],
        cacheStatus: 'n/a',
        tokensUsed: 0,
        status: 'blocked_quota',
        latencyMs: Date.now() - start,
      });
      const resetDate = new Date(quotaState.snapshot.periodStart);
      resetDate.setMonth(resetDate.getMonth() + 1);
      quotaExceeded(resetDate.toISOString().slice(0, 10));
    }

    const convId = conversationId || (await this.createConversation(user.id, message));
    await this.insertMessage(convId, 'user', message);

    const tools = this.mcp.listTools();
    const systemPrompt =
      'You are a SAP manufacturing assistant. Always include warehouseId for warehouse-touching tools. If warehouseId is unknown, ask the user. Never claim a write action has already completed before confirmation.';

    const conversationHistory = await this.getConversationMessages(convId);
    const llmMessages: LlmChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({ role: m.role as 'user' | 'assistant' | 'tool', content: m.content })),
    ];

    const provider = this.providerFactory.getProvider();
    let source: 'cache' | 'live' = 'live';
    const invokedTools: string[] = [];
    let finalText = '';

    try {
      for (let round = 0; round < 8; round += 1) {
        let completion;
        try {
          completion = await provider.complete(
            llmMessages,
            tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
          );
        } catch {
          return this.handleFallbackWithoutLlm(user, convId, message, start, invokedTools);
        }

        await this.quota.recordUsage({
          userId: user.id,
          promptTokens: completion.promptTokens,
          completionTokens: completion.completionTokens,
          modelUsed: completion.modelUsed,
          isEstimated: completion.isEstimated || false,
        });

        const usage = await this.quota.getUsage(user.id);
        this.realtime.emitTokenDelta(user.id, { used: usage.used, limit: usage.limit });

        if (completion.toolCalls && completion.toolCalls.length > 0) {
          for (const call of completion.toolCalls) {
            invokedTools.push(call.name);

            const toolDesc = this.mcp.getTool(call.name);
            const warehouseId = (call.arguments.warehouseId as string | undefined) || undefined;
            if (this.requiresWarehouseScope(toolDesc?.inputSchema)) {
              this.assertScope(user, warehouseId);
            }

            if (WRITE_TOOLS.has(call.name)) {
              const action: PendingAction = {
                actionId: randomUUID(),
                tool: call.name,
                params: call.arguments,
                humanSummary: `Confirm ${call.name} with parameters ${JSON.stringify(call.arguments)}`,
              };

              await this.redis.raw.setEx(
                `pending:action:${action.actionId}`,
                900,
                JSON.stringify({ userId: user.id, action }),
              );
              this.realtime.emitPendingAction(user.id, action);

              const assistantText = 'I prepared a write action. Please confirm to execute.';
              await this.insertMessage(convId, 'assistant', assistantText, call);
              const msgId = randomUUID();
              this.realtime.emitChatToken(user.id, { conversationId: convId, delta: assistantText });
              this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source: 'live' });

              await this.writeSessionLog({
                userId: user.id,
                conversationId: convId,
                queryText: message,
                toolsInvoked: invokedTools,
                cacheStatus: 'n/a',
                tokensUsed: completion.promptTokens + completion.completionTokens,
                status: 'success',
                latencyMs: Date.now() - start,
              });

              return {
                conversationId: convId,
                messageId: msgId,
                text: assistantText,
                source: 'live',
                pendingAction: action,
              };
            }

            const { data, cacheHit } = await this.readToolWithCache(call.name, call.arguments);
            source = cacheHit ? 'cache' : source;
            llmMessages.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: JSON.stringify(data),
            });
          }
          continue;
        }

        finalText = completion.text || "I wasn't able to complete that — could you rephrase?";
        break;
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'unknown error';
      const status = messageText.toLowerCase().includes('scope') ? 'blocked_scope' : 'error';
      await this.writeSessionLog({
        userId: user.id,
        conversationId: convId,
        queryText: message,
        toolsInvoked: invokedTools,
        cacheStatus: 'n/a',
        tokensUsed: 0,
        status,
        latencyMs: Date.now() - start,
      });
      throw error;
    }

    if (!finalText) {
      finalText = "I wasn't able to complete that — could you rephrase?";
    }

    await this.insertMessage(convId, 'assistant', finalText);
    const messageId = randomUUID();
    this.realtime.emitChatToken(user.id, { conversationId: convId, delta: finalText });
    this.realtime.emitChatDone(user.id, { conversationId: convId, messageId, source });

    await this.writeSessionLog({
      userId: user.id,
      conversationId: convId,
      queryText: message,
      toolsInvoked: invokedTools,
      cacheStatus: source === 'cache' ? 'hit' : invokedTools.length ? 'miss' : 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: Date.now() - start,
    });

    return {
      conversationId: convId,
      messageId,
      text: finalText,
      source,
    };
  }

  async confirmAction(user: AuthUser, actionId: string) {
    const raw = await this.redis.raw.getDel(`pending:action:${actionId}`);
    if (!raw) {
      actionExpired();
    }

    const payload = JSON.parse(raw) as { userId: string; action: PendingAction };
    if (payload.userId !== user.id) {
      actionExpired();
    }

    const params = payload.action.params;
    const warehouseId = params.warehouseId as string | undefined;
    this.assertScope(user, warehouseId);

    const result = await this.mcp.callTool(payload.action.tool, params);

    if (payload.action.tool === 'moveStock') {
      const warehouse = String(params.warehouseId || 'global');
      await this.invalidateWarehouseCache(warehouse);
      const movement = (result?.structuredContent || result) as Record<string, unknown>;
      await this.redis.raw.zAdd(`cache:movements:${warehouse}`, {
        score: Date.now(),
        value: JSON.stringify(movement),
      });
    }

    await this.writeSessionLog({
      userId: user.id,
      conversationId: null,
      queryText: `confirm-action:${actionId}`,
      toolsInvoked: [payload.action.tool],
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: 0,
    });

    return { success: true, actionId, result };
  }

  private assertScope(user: AuthUser, warehouseId?: string) {
    if (!warehouseId) {
      scopeDenied('warehouseId is required for this tool');
    }

    if (user.role === 'admin') {
      return;
    }

    if (!user.scopes.includes(warehouseId)) {
      scopeDenied(`Warehouse ${warehouseId} is not assigned to your user`);
    }
  }

  private async handleFallbackWithoutLlm(
    user: AuthUser,
    convId: string,
    message: string,
    start: number,
    invokedTools: string[],
  ): Promise<ChatResponse> {
    const lower = message.toLowerCase();

    const materialId = message.match(/MAT-\d{6,}/i)?.[0];
    const warehouseId = message.match(/\b\d{4}\b/)?.[0];

    if (lower.includes('move product')) {
      const match = message.match(
        /move product\s+([A-Za-z0-9-]+)\s+from\s+([A-Za-z0-9-]+)\s+to\s+([A-Za-z0-9-]+).*warehouse\s+(\d{4}).*qty\s+(\d+)/i,
      );

      if (!match) {
        const ask = 'Please provide productId, fromLocation, toLocation, warehouseId, and qty.';
        await this.insertMessage(convId, 'assistant', ask);
        await this.writeSessionLog({
          userId: user.id,
          conversationId: convId,
          queryText: message,
          toolsInvoked: invokedTools,
          cacheStatus: 'n/a',
          tokensUsed: 0,
          status: 'success',
          latencyMs: Date.now() - start,
        });
        return { conversationId: convId, text: ask, source: 'live' };
      }

      const [, productId, fromLocation, toLocation, wh, qtyRaw] = match;
      this.assertScope(user, wh);

      const action: PendingAction = {
        actionId: randomUUID(),
        tool: 'moveStock',
        params: {
          productId,
          fromLocation,
          toLocation,
          warehouseId: wh,
          qty: Number(qtyRaw),
        },
        humanSummary: `Confirm moveStock for ${productId} from ${fromLocation} to ${toLocation} in warehouse ${wh} qty ${qtyRaw}`,
      };

      await this.redis.raw.setEx(`pending:action:${action.actionId}`, 900, JSON.stringify({ userId: user.id, action }));
      this.realtime.emitPendingAction(user.id, action);

      const assistantText = 'I prepared a write action. Please confirm to execute.';
      await this.insertMessage(convId, 'assistant', assistantText);
      const msgId = randomUUID();
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: assistantText });
      this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source: 'live' });

      await this.writeSessionLog({
        userId: user.id,
        conversationId: convId,
        queryText: message,
        toolsInvoked: ['moveStock'],
        cacheStatus: 'n/a',
        tokensUsed: 0,
        status: 'success',
        latencyMs: Date.now() - start,
      });

      return {
        conversationId: convId,
        messageId: msgId,
        text: assistantText,
        source: 'live',
        pendingAction: action,
      };
    }

    if ((lower.includes('stock') || lower.includes('show')) && materialId && warehouseId) {
      this.assertScope(user, warehouseId);
      const { data, cacheHit } = await this.readToolWithCache('getStockLevel', { materialId, warehouseId });
      const text = JSON.stringify((data as Record<string, unknown>).structuredContent || data);
      await this.insertMessage(convId, 'assistant', text);
      const msgId = randomUUID();
      const source = cacheHit ? 'cache' : 'live';
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: text });
      this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source });
      await this.writeSessionLog({
        userId: user.id,
        conversationId: convId,
        queryText: message,
        toolsInvoked: ['getStockLevel'],
        cacheStatus: cacheHit ? 'hit' : 'miss',
        tokensUsed: 0,
        status: 'success',
        latencyMs: Date.now() - start,
      });
      return { conversationId: convId, messageId: msgId, text, source };
    }

    if (lower.includes('material') && materialId) {
      const { data, cacheHit } = await this.readToolWithCache('getMaterialDetails', { materialId });
      const text = JSON.stringify((data as Record<string, unknown>).structuredContent || data);
      await this.insertMessage(convId, 'assistant', text);
      const msgId = randomUUID();
      const source = cacheHit ? 'cache' : 'live';
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: text });
      this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source });
      await this.writeSessionLog({
        userId: user.id,
        conversationId: convId,
        queryText: message,
        toolsInvoked: ['getMaterialDetails'],
        cacheStatus: cacheHit ? 'hit' : 'miss',
        tokensUsed: 0,
        status: 'success',
        latencyMs: Date.now() - start,
      });
      return { conversationId: convId, messageId: msgId, text, source };
    }

    const fallbackText =
      "I couldn't use the configured LLM right now. Try a structured command like: show stock for material MAT-10023456 in warehouse 1010.";
    await this.insertMessage(convId, 'assistant', fallbackText);
    const msgId = randomUUID();
    this.realtime.emitChatToken(user.id, { conversationId: convId, delta: fallbackText });
    this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source: 'live' });
    await this.writeSessionLog({
      userId: user.id,
      conversationId: convId,
      queryText: message,
      toolsInvoked: invokedTools,
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'error',
      latencyMs: Date.now() - start,
    });
    return { conversationId: convId, messageId: msgId, text: fallbackText, source: 'live' };
  }

  private requiresWarehouseScope(inputSchema: Record<string, unknown> | undefined) {
    if (!inputSchema) {
      return false;
    }

    const direct = (inputSchema as Record<string, unknown>).warehouseId;
    if (direct !== undefined) {
      return true;
    }

    const properties = (inputSchema as { properties?: Record<string, unknown> }).properties;
    return !!properties?.warehouseId;
  }

  private async readToolWithCache(toolName: string, params: Record<string, unknown>) {
    if (toolName === 'getRecentMovements') {
      const live = await this.mcp.callTool(toolName, params);
      return { data: live, cacheHit: false };
    }

    const warehouseKey = (params.warehouseId as string | undefined) || 'global';
    const paramsHash = this.sortedHash(params);
    const cacheKey = `cache:${toolName}:${warehouseKey}:${paramsHash}`;

    const hit = await this.redis.raw.get(cacheKey);
    if (hit) {
      return { data: JSON.parse(hit), cacheHit: true };
    }

    const live = await this.mcp.callTool(toolName, params);
    await this.redis.raw.setEx(cacheKey, this.cacheTtlSeconds, JSON.stringify(live));
    return { data: live, cacheHit: false };
  }

  private sortedHash(params: Record<string, unknown>) {
    const normalized = JSON.stringify(this.sortObject(params));
    return createHash('sha256').update(normalized).digest('hex');
  }

  private sortObject(input: unknown): unknown {
    if (Array.isArray(input)) {
      return input.map((item) => this.sortObject(item));
    }

    if (input && typeof input === 'object') {
      const obj = input as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortObject(obj[key]);
          return acc;
        }, {});
    }

    return input;
  }

  private async createConversation(userId: string, message: string): Promise<string> {
    const title = message.slice(0, 80);
    const row = await this.db.query<{ id: string }>(
      'INSERT INTO conversations(user_id, title) VALUES($1, $2) RETURNING id',
      [userId, title],
    );
    return row.rows[0].id;
  }

  private async insertMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
    toolCalls?: unknown,
  ) {
    await this.db.query(
      'INSERT INTO conversation_messages(conversation_id, role, content, tool_calls_json) VALUES($1, $2, $3, $4)',
      [conversationId, role, content, toolCalls ? JSON.stringify(toolCalls) : null],
    );
  }

  private async getConversationMessages(conversationId: string) {
    const rows = await this.db.query<{ role: string; content: string }>(
      `SELECT role, content
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return rows.rows;
  }

  private async invalidateWarehouseCache(warehouseId: string) {
    const keys = await this.redis.raw.keys(`cache:*:${warehouseId}:*`);
    if (keys.length > 0) {
      await this.redis.raw.del(keys);
    }
  }

  private async writeSessionLog(args: {
    userId: string;
    conversationId: string | null;
    queryText: string;
    toolsInvoked: string[];
    cacheStatus: 'hit' | 'miss' | 'n/a';
    tokensUsed: number;
    status: 'success' | 'error' | 'blocked_scope' | 'blocked_quota';
    latencyMs: number;
  }) {
    const row = await this.db.query<SessionLogEntry>(
      `INSERT INTO session_logs(
          user_id,
          conversation_id,
          query_text,
          tools_invoked_json,
          cache_status,
          tokens_used,
          status,
          latency_ms
       ) VALUES($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        args.userId,
        args.conversationId,
        args.queryText,
        JSON.stringify(args.toolsInvoked),
        args.cacheStatus,
        args.tokensUsed,
        args.status,
        args.latencyMs,
      ],
    );

    this.realtime.emitSessionLog(row.rows[0]);
  }
}
