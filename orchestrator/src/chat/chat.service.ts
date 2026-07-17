import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ChatResponse, PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';
import { DbService } from '../common/db.service';
import { actionExpired, quotaExceeded, scopeDenied, throwApiError, validationError } from '../common/errors';
import type { AuthUser } from '../common/types';
import { LlmProviderFactory } from '../llm/provider.factory';
import type { LlmChatMessage } from '../llm/types';
import { McpService } from '../mcp/mcp.service';
import { QuotaService } from '../quota/quota.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../common/redis.service';
import { AlertsService } from '../alerts/alerts.service';
import type { NormalizedToolCall } from '../llm/types';

const WRITE_TOOLS = new Set(['moveStock', 'draftPurchaseRequisition']);

// Tools served by the orchestrator itself (user-scoped state), not by an MCP server.
const LOCAL_TOOLS = [
  {
    name: 'createStockAlert',
    description:
      'Create a stock alert for the current user. They will be notified when the total stock of a material in a warehouse drops below the threshold. Use when the user asks to be alerted, notified, or watched about stock levels.',
    inputSchema: {
      type: 'object',
      properties: {
        warehouseId: { type: 'string' },
        materialId: { type: 'string' },
        threshold: { type: 'number' },
      },
      required: ['warehouseId', 'materialId', 'threshold'],
    },
  },
  {
    name: 'listStockAlerts',
    description: "List the current user's active stock alerts.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'suggestReorders',
    description:
      'Analyze a warehouse and suggest reorder quantities: combines low-stock positions with inbound purchase orders and proposes how much to order. Use when the user asks what to reorder, replenish, or restock.',
    inputSchema: {
      type: 'object',
      properties: {
        warehouseId: { type: 'string' },
        threshold: { type: 'number' },
      },
      required: ['warehouseId'],
    },
  },
  {
    name: 'getShiftHandover',
    description:
      'Build a shift-handover summary for a warehouse: movements in the last 24h, current low-stock positions, and triggered alerts. Use when the user asks for a handover, daily summary, or what happened today.',
    inputSchema: {
      type: 'object',
      properties: { warehouseId: { type: 'string' } },
      required: ['warehouseId'],
    },
  },
];

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS || 8640000);

  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly providerFactory: LlmProviderFactory,
    private readonly mcp: McpService,
    private readonly quota: QuotaService,
    private readonly realtime: RealtimeGateway,
    private readonly alerts: AlertsService,
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

    // Query dedupe: identical (normalized) read questions from the same user
    // within the TTL replay the cached answer without spending tokens.
    const dedupeKey = `answer:${user.id}:${this.sortedHash({ q: this.normalizeQuery(message) })}`;
    const cachedAnswer = await this.redis.raw.get(dedupeKey);
    if (cachedAnswer) {
      const cached = JSON.parse(cachedAnswer) as { text: string; grounded: boolean };
      await this.insertMessage(convId, 'assistant', cached.text);
      const msgId = randomUUID();
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: cached.text });
      this.realtime.emitChatDone(user.id, {
        conversationId: convId,
        messageId: msgId,
        source: 'cache',
        grounded: cached.grounded,
      });
      await this.writeSessionLog({
        userId: user.id,
        conversationId: convId,
        queryText: message,
        toolsInvoked: [],
        cacheStatus: 'hit',
        tokensUsed: 0,
        status: 'success',
        latencyMs: Date.now() - start,
      });
      return { conversationId: convId, messageId: msgId, text: cached.text, source: 'cache', grounded: cached.grounded };
    }

    const tools = [...this.mcp.listTools(), ...LOCAL_TOOLS];
    const systemPrompt =
      'You are a SAP manufacturing assistant. Always include warehouseId for warehouse-touching tools. ' +
      'If warehouseId is unknown, ask the user. Never claim a write action has already completed before confirmation. ' +
      'Invoke tools ONLY through the function-calling mechanism; never print a JSON tool call as text. ' +
      'Copy parameter values exactly as the user stated them (e.g. location names like "packing" or "shipping"). ' +
      'You can create stock alerts (createStockAlert) when the user asks to be notified about stock levels.';

    const conversationHistory = await this.getConversationMessages(convId);
    const llmMessages: LlmChatMessage[] = [{ role: 'system', content: systemPrompt }, ...conversationHistory];

    const provider = this.providerFactory.getProvider();
    let source: 'cache' | 'live' = 'live';
    const invokedTools: string[] = [];
    let finalText = '';
    let totalTokens = 0;
    let streamedChars = 0;

    const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    const onTextDelta = (delta: string) => {
      streamedChars += delta.length;
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta });
    };

    try {
      for (let round = 0; round < 8; round += 1) {
        let completion;
        try {
          completion = provider.completeStream
            ? await provider.completeStream(llmMessages, toolDefs, onTextDelta)
            : await provider.complete(llmMessages, toolDefs);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(`LLM provider call failed, using keyword fallback: ${reason}`);
          return this.handleFallbackWithoutLlm(user, convId, message, start, invokedTools);
        }

        if (!completion.toolCalls?.length) {
          const salvaged = this.salvageToolCallFromText(completion.text);
          if (salvaged) {
            this.logger.warn(`Salvaged tool call ${salvaged.name} from plain-text model output`);
            completion = { ...completion, toolCalls: [salvaged], text: '' };
          }
        }

        totalTokens += completion.promptTokens + completion.completionTokens;
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
          llmMessages.push({
            role: 'assistant',
            content: completion.text || '',
            toolCalls: completion.toolCalls,
          });
          await this.insertMessage(convId, 'assistant', completion.text || '', completion.toolCalls);

          const writeCalls: NormalizedToolCall[] = [];

          for (const call of completion.toolCalls) {
            invokedTools.push(call.name);

            const toolDesc = this.getToolDescriptor(call.name);
            const warehouseId = (call.arguments.warehouseId as string | undefined) || undefined;
            if (this.requiresWarehouseScope(toolDesc?.inputSchema)) {
              this.assertScope(user, warehouseId, WRITE_TOOLS.has(call.name) ? 'write' : 'read');
            }

            if (WRITE_TOOLS.has(call.name)) {
              writeCalls.push(call);
              continue;
            }

            const { data, cacheHit } = this.isLocalTool(call.name)
              ? { data: await this.executeLocalTool(user, call.name, call.arguments), cacheHit: false }
              : await this.readToolWithCache(call.name, call.arguments);
            source = cacheHit ? 'cache' : source;
            const toolContent = JSON.stringify(data);
            llmMessages.push({
              role: 'tool',
              name: call.name,
              toolCallId: call.id,
              content: toolContent,
            });
            await this.insertMessage(convId, 'tool', toolContent, { toolCallId: call.id, name: call.name });
          }

          if (writeCalls.length > 0) {
            const warehouseIds = [...new Set(writeCalls.map((c) => String(c.arguments.warehouseId || '')))].filter(
              Boolean,
            );
            const policy = await this.resolveWritePolicy(user.id, warehouseIds);

            let anomaly: { reason: string } | null = null;
            for (const call of writeCalls) {
              if (call.name === 'moveStock') {
                anomaly = await this.analyzeMoveAnomaly(
                  String(call.arguments.warehouseId || ''),
                  Number(call.arguments.qty || 0),
                );
                if (anomaly) {
                  break;
                }
              }
            }

            const allAutoApprovable =
              !anomaly &&
              !policy.makerChecker &&
              policy.autoMax !== null &&
              writeCalls.every(
                (c) => Number.isFinite(Number(c.arguments.qty)) && Number(c.arguments.qty) <= (policy.autoMax as number),
              );

            if (allAutoApprovable) {
              // Policy allows executing these writes without human sign-off.
              for (const call of writeCalls) {
                const result = await this.executeWriteTool(call.name, call.arguments);
                const toolContent = JSON.stringify({ ...result, autoApproved: true, policyMaxQty: policy.autoMax });
                llmMessages.push({ role: 'tool', name: call.name, toolCallId: call.id, content: toolContent });
                await this.insertMessage(convId, 'tool', toolContent, { toolCallId: call.id, name: call.name });
              }
              continue;
            }

            const base: PendingAction =
              writeCalls.length === 1
                ? {
                    actionId: randomUUID(),
                    tool: writeCalls[0].name,
                    params: writeCalls[0].arguments,
                    humanSummary: `Confirm ${writeCalls[0].name} with parameters ${JSON.stringify(writeCalls[0].arguments)}`,
                  }
                : {
                    actionId: randomUUID(),
                    tool: 'batch',
                    params: {
                      steps: writeCalls.map((c) => ({ tool: c.name, params: c.arguments })),
                    },
                    humanSummary: `Confirm ${writeCalls.length} operations: ${writeCalls
                      .map((c) => c.name)
                      .join(', ')}`,
                  };

            const action: PendingAction = {
              ...base,
              requestedBy: user.displayName,
              requestedById: user.id,
              makerChecker: policy.makerChecker,
              ...(anomaly ? { anomaly } : {}),
            };

            await this.redis.raw.setEx(
              `pending:action:${action.actionId}`,
              900,
              JSON.stringify({ userId: user.id, action }),
            );
            this.realtime.emitPendingAction(user.id, action);

            const assistantText =
              writeCalls.length === 1
                ? 'I prepared a write action. Please confirm to execute.'
                : `I prepared ${writeCalls.length} write actions as one workflow. Please confirm to execute.`;
            await this.insertMessage(convId, 'assistant', assistantText);
            const msgId = randomUUID();
            this.realtime.emitChatToken(user.id, { conversationId: convId, delta: assistantText });
            this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source: 'live' });

            await this.writeSessionLog({
              userId: user.id,
              conversationId: convId,
              queryText: message,
              toolsInvoked: invokedTools,
              cacheStatus: 'n/a',
              tokensUsed: totalTokens,
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
        tokensUsed: totalTokens,
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
    const grounded = invokedTools.length > 0;
    if (streamedChars === 0) {
      // Non-streaming provider: emit the full text as a single chunk.
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: finalText });
    }
    this.realtime.emitChatDone(user.id, { conversationId: convId, messageId, source, grounded });

    if (grounded && finalText) {
      const ttl = Number(process.env.ANSWER_DEDUPE_TTL_SECONDS || 600);
      await this.redis.raw.setEx(dedupeKey, ttl, JSON.stringify({ text: finalText, grounded }));
    }

    await this.writeSessionLog({
      userId: user.id,
      conversationId: convId,
      queryText: message,
      toolsInvoked: invokedTools,
      cacheStatus: source === 'cache' ? 'hit' : invokedTools.length ? 'miss' : 'n/a',
      tokensUsed: totalTokens,
      status: 'success',
      latencyMs: Date.now() - start,
    });

    return {
      conversationId: convId,
      messageId,
      text: finalText,
      source,
      grounded,
    };
  }

  private normalizeQuery(message: string) {
    return message.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  async confirmAction(user: AuthUser, actionId: string) {
    const raw = await this.redis.raw.getDel(`pending:action:${actionId}`);
    if (!raw) {
      actionExpired();
    }

    const payload = JSON.parse(raw) as { userId: string; action: PendingAction };

    // Admins may approve other users' pending actions (they act as checkers).
    if (payload.userId !== user.id && user.role !== 'admin') {
      actionExpired();
    }

    // Maker-checker: the requester cannot approve their own action. Restore the
    // pending entry so a second approver can still act on it.
    if (payload.action.makerChecker && payload.userId === user.id) {
      await this.redis.raw.setEx(`pending:action:${actionId}`, 900, raw);
      throwApiError(
        403,
        'SCOPE_DENIED',
        'This action requires a second approver (maker-checker policy). Another administrator must approve it.',
      );
    }

    const steps: Array<{ tool: string; params: Record<string, unknown> }> =
      payload.action.tool === 'batch'
        ? ((payload.action.params.steps || []) as Array<{ tool: string; params: Record<string, unknown> }>)
        : [{ tool: payload.action.tool, params: payload.action.params }];

    for (const step of steps) {
      this.assertScope(user, step.params.warehouseId as string | undefined, 'write');
    }

    const results: Array<Record<string, unknown>> = [];
    for (const [index, step] of steps.entries()) {
      try {
        results.push(await this.executeWriteTool(step.tool, step.params));
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'tool call failed';
        await this.writeSessionLog({
          userId: user.id,
          conversationId: null,
          queryText: `confirm-action:${actionId}`,
          toolsInvoked: steps.map((s) => s.tool),
          cacheStatus: 'n/a',
          tokensUsed: 0,
          status: 'error',
          latencyMs: 0,
        });
        const prefix = steps.length > 1 ? `Step ${index + 1}/${steps.length} (${step.tool}) failed: ` : '';
        if (reason.includes('INSUFFICIENT_STOCK')) {
          throwApiError(400, 'INSUFFICIENT_STOCK', `${prefix}${reason}`);
        }
        validationError(`${prefix}${reason}`);
      }
    }

    await this.writeSessionLog({
      userId: user.id,
      conversationId: null,
      queryText: `confirm-action:${actionId}`,
      toolsInvoked: steps.map((s) => s.tool),
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: 0,
    });

    return { success: true, actionId, result: steps.length === 1 ? results[0] : { steps: results } };
  }

  /** Live stock for the kanban operations board (scope-checked, cached). */
  async getWarehouseBoard(user: AuthUser, warehouseId: string) {
    if (!warehouseId) {
      validationError('warehouseId is required');
    }
    this.assertScope(user, warehouseId, 'read');

    const { data, cacheHit } = await this.readToolWithCache('listWarehouseStock', { warehouseId });
    const structured = (data as { structuredContent?: { records?: unknown[]; dataSource?: string } })
      .structuredContent;
    return {
      warehouseId,
      records: structured?.records ?? [],
      dataSource: structured?.dataSource ?? 'simulator',
      source: cacheHit ? 'cache' : 'live',
    };
  }

  /**
   * Board drag-and-drop move: same governance as chat writes — scope, anomaly
   * detection, auto-approve policy, maker-checker, pending approval.
   */
  async proposeMove(
    user: AuthUser,
    params: { warehouseId: string; productId: string; fromLocation: string; toLocation: string; qty: number },
  ) {
    this.assertScope(user, params.warehouseId, 'write');

    const policy = await this.resolveWritePolicy(user.id, [params.warehouseId]);
    const anomaly = await this.analyzeMoveAnomaly(params.warehouseId, params.qty);
    const args: Record<string, unknown> = { ...params };

    if (!anomaly && !policy.makerChecker && policy.autoMax !== null && params.qty <= policy.autoMax) {
      const result = await this.executeWriteTool('moveStock', args);
      await this.writeSessionLog({
        userId: user.id,
        conversationId: null,
        queryText: `board-move:${params.productId} ${params.fromLocation}→${params.toLocation} x${params.qty}`,
        toolsInvoked: ['moveStock'],
        cacheStatus: 'n/a',
        tokensUsed: 0,
        status: 'success',
        latencyMs: 0,
      });
      return { executed: true, autoApproved: true, result };
    }

    const action: PendingAction = {
      actionId: randomUUID(),
      tool: 'moveStock',
      params: args,
      humanSummary: `Move ${params.qty} × ${params.productId} from ${params.fromLocation} to ${params.toLocation} in warehouse ${params.warehouseId} (from the operations board)`,
      requestedBy: user.displayName,
      requestedById: user.id,
      makerChecker: policy.makerChecker,
      ...(anomaly ? { anomaly } : {}),
    };

    await this.redis.raw.setEx(
      `pending:action:${action.actionId}`,
      900,
      JSON.stringify({ userId: user.id, action }),
    );
    this.realtime.emitPendingAction(user.id, action);

    await this.writeSessionLog({
      userId: user.id,
      conversationId: null,
      queryText: `board-move:${params.productId} ${params.fromLocation}→${params.toLocation} x${params.qty}`,
      toolsInvoked: ['moveStock'],
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: 0,
    });

    return { executed: false, pendingAction: action };
  }

  /** Executes a write tool through MCP and maintains the caches it touches. */
  private async executeWriteTool(tool: string, params: Record<string, unknown>) {
    const result = await this.mcp.callTool(tool, params);

    if (tool === 'moveStock') {
      const warehouse = String(params.warehouseId || 'global');
      await this.invalidateWarehouseCache(warehouse);
      const movement = (result?.structuredContent || result) as Record<string, unknown>;
      await this.redis.raw.zAdd(`cache:movements:${warehouse}`, {
        score: Date.now(),
        value: JSON.stringify(movement),
      });
    }

    return result;
  }

  private isLocalTool(name: string) {
    return LOCAL_TOOLS.some((t) => t.name === name);
  }

  private getToolDescriptor(name: string): { inputSchema?: Record<string, unknown> } | undefined {
    return this.mcp.getTool(name) || LOCAL_TOOLS.find((t) => t.name === name);
  }

  private async executeLocalTool(user: AuthUser, name: string, args: Record<string, unknown>) {
    if (name === 'createStockAlert') {
      const alert = await this.alerts.createAlert(
        user,
        String(args.warehouseId || ''),
        String(args.materialId || ''),
        Number(args.threshold),
      );
      return {
        structuredContent: {
          created: true,
          alert: {
            id: alert.id,
            warehouseId: alert.warehouse_id,
            materialId: alert.material_id,
            threshold: alert.threshold,
          },
          note: 'The user will be notified when total stock drops below the threshold.',
        },
      };
    }

    if (name === 'listStockAlerts') {
      const rows = await this.alerts.listAlerts(user.id);
      return {
        structuredContent: {
          records: rows.map((r) => ({
            id: r.id,
            warehouseId: r.warehouse_id,
            materialId: r.material_id,
            threshold: r.threshold,
            triggered: r.triggered,
          })),
        },
      };
    }

    if (name === 'suggestReorders') {
      const warehouseId = String(args.warehouseId || '');
      const threshold = Number(args.threshold || 50);
      const [lowStock, pos] = await Promise.all([
        this.mcp.callTool('getLowStock', { warehouseId, threshold }),
        this.mcp.callTool('getPurchaseOrders', { warehouseId }),
      ]);

      const lowRecords = ((lowStock.structuredContent as { records?: Array<Record<string, unknown>> })?.records ||
        []) as Array<Record<string, unknown>>;
      const poRecords = ((pos.structuredContent as { records?: Array<Record<string, unknown>> })?.records ||
        []) as Array<Record<string, unknown>>;

      const suggestions = lowRecords.map((r) => {
        const materialId = String(r.materialId);
        const currentQty = Number(r.quantity || 0);
        const inbound = poRecords
          .filter((po) => po.materialId === materialId && po.status !== 'delivered')
          .reduce((sum, po) => sum + Number(po.qty || 0), 0);
        const target = threshold * 2;
        const suggestedQty = Math.max(target - currentQty - inbound, 0);
        return {
          materialId,
          location: r.location,
          currentQty,
          inboundQty: inbound,
          targetLevel: target,
          suggestedOrderQty: suggestedQty,
          action: suggestedQty > 0 ? 'reorder recommended' : 'covered by inbound orders',
        };
      });

      return {
        structuredContent: {
          warehouseId,
          records: suggestions,
          note: 'Use draftPurchaseRequisition to create a draft order for any suggestion the user accepts.',
        },
      };
    }

    if (name === 'getShiftHandover') {
      const warehouseId = String(args.warehouseId || '');
      const [movements, lowStock] = await Promise.all([
        this.mcp.callTool('getRecentMovements', { warehouseId, sinceHours: 24 }),
        this.mcp.callTool('getLowStock', { warehouseId, threshold: 50 }),
      ]);
      const triggeredAlerts = (await this.alerts.listAlerts(user.id)).filter(
        (a) => a.warehouse_id === warehouseId && a.triggered,
      );

      return {
        structuredContent: {
          warehouseId,
          generatedAt: new Date().toISOString(),
          movementsLast24h:
            (movements.structuredContent as { records?: unknown[] })?.records ?? [],
          lowStockPositions: (lowStock.structuredContent as { records?: unknown[] })?.records ?? [],
          triggeredAlerts: triggeredAlerts.map((a) => ({
            materialId: a.material_id,
            threshold: a.threshold,
          })),
        },
      };
    }

    validationError(`Unknown local tool: ${name}`);
  }

  /**
   * Flags a stock move as anomalous when its quantity is far above the recent
   * average for that warehouse (5x, with at least 3 prior movements).
   */
  private async analyzeMoveAnomaly(warehouseId: string, qty: number): Promise<{ reason: string } | null> {
    try {
      const raw = await this.redis.raw.zRange(`cache:movements:${warehouseId}`, -30, -1);
      const quantities = raw
        .map((item: string) => {
          const parsed = JSON.parse(item) as { qty?: number; movement?: { qty?: number } };
          return Number(parsed.qty ?? parsed.movement?.qty ?? 0);
        })
        .filter((q: number) => q > 0);
      if (quantities.length < 3) {
        return null;
      }
      const avg = quantities.reduce((a: number, b: number) => a + b, 0) / quantities.length;
      if (qty >= avg * 5) {
        return {
          reason: `Quantity ${qty} is ${(qty / avg).toFixed(1)}× the recent average of ${avg.toFixed(0)} for warehouse ${warehouseId}`,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Combines the requester's policy with warehouse policies: most restrictive wins. */
  private async resolveWritePolicy(userId: string, warehouseIds: string[]) {
    const userRow = await this.db.query<{ auto_approve_max_qty: number | null; maker_checker: boolean }>(
      'SELECT auto_approve_max_qty, maker_checker FROM approval_policies WHERE user_id = $1',
      [userId],
    );
    const whRows = warehouseIds.length
      ? await this.db.query<{ auto_approve_max_qty: number | null; maker_checker: boolean }>(
          'SELECT auto_approve_max_qty, maker_checker FROM warehouse_policies WHERE warehouse_id = ANY($1)',
          [warehouseIds],
        )
      : { rows: [] as Array<{ auto_approve_max_qty: number | null; maker_checker: boolean }> };

    const limits = [userRow.rows[0]?.auto_approve_max_qty, ...whRows.rows.map((r) => r.auto_approve_max_qty)].filter(
      (v): v is number => v !== null && v !== undefined,
    );
    const makerChecker = Boolean(userRow.rows[0]?.maker_checker) || whRows.rows.some((r) => r.maker_checker);

    return {
      // Auto-approve only when the user policy grants it; warehouse policies can only tighten.
      autoMax: userRow.rows[0]?.auto_approve_max_qty != null && limits.length ? Math.min(...limits) : null,
      makerChecker,
    };
  }


  private assertScope(user: AuthUser, warehouseId: string | undefined, need: 'read' | 'write' = 'read') {
    if (!warehouseId) {
      scopeDenied('warehouseId is required for this tool');
    }

    if (user.role === 'admin') {
      return;
    }

    const scope = user.scopes.find((s) => s.warehouseId === warehouseId);
    if (!scope) {
      scopeDenied(`Warehouse ${warehouseId} is not assigned to your user`);
    }

    if (need === 'write' && scope.accessLevel !== 'write') {
      scopeDenied(`You have read-only access to warehouse ${warehouseId}`);
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
      this.assertScope(user, wh, 'write');

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

  /**
   * Small self-hosted models sometimes print a tool call as JSON text instead
   * of using function calling. If the text is exactly that, convert it into a
   * real tool call so the agent loop still works.
   */
  private salvageToolCallFromText(text: string | undefined) {
    if (!text) {
      return null;
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const name = (parsed.name || parsed.tool) as string | undefined;
      const args = (parsed.arguments || parsed.parameters || parsed.params) as
        | Record<string, unknown>
        | undefined;
      if (name && args && typeof args === 'object' && this.mcp.getTool(name)) {
        return { id: `salvaged-${randomUUID()}`, name, arguments: args };
      }
    } catch {
      return null;
    }

    return null;
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

  private async getConversationMessages(conversationId: string): Promise<LlmChatMessage[]> {
    const rows = await this.db.query<{ role: 'user' | 'assistant' | 'tool'; content: string; tool_calls_json: unknown }>(
      `SELECT role, content, tool_calls_json
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );

    const messages: LlmChatMessage[] = rows.rows.map((row) => {
      if (row.role === 'assistant' && Array.isArray(row.tool_calls_json)) {
        return {
          role: 'assistant' as const,
          content: row.content,
          toolCalls: row.tool_calls_json as LlmChatMessage['toolCalls'],
        };
      }
      if (row.role === 'tool') {
        const meta = (row.tool_calls_json || {}) as { toolCallId?: string; name?: string };
        return { role: 'tool' as const, content: row.content, toolCallId: meta.toolCallId, name: meta.name };
      }
      return { role: row.role, content: row.content };
    });

    return this.sanitizeHistory(messages);
  }

  /**
   * Providers reject assistant tool-call turns whose results never made it into
   * the transcript (e.g. writes routed to the confirm flow) and tool results
   * with no preceding tool-call turn. Strip both so replayed history is valid.
   */
  private sanitizeHistory(messages: LlmChatMessage[]): LlmChatMessage[] {
    const result: LlmChatMessage[] = [];

    for (let i = 0; i < messages.length; i += 1) {
      const msg = messages[i];

      if (msg.role === 'tool') {
        const prev = result[result.length - 1];
        const prevHasCall =
          prev &&
          ((prev.role === 'assistant' && prev.toolCalls?.some((tc) => tc.id === msg.toolCallId)) ||
            prev.role === 'tool');
        if (prevHasCall) {
          result.push(msg);
        }
        continue;
      }

      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        const followingToolIds = new Set<string>();
        for (let j = i + 1; j < messages.length && messages[j].role === 'tool'; j += 1) {
          const id = messages[j].toolCallId;
          if (id) {
            followingToolIds.add(id);
          }
        }
        const complete = msg.toolCalls.every((tc) => followingToolIds.has(tc.id));
        if (complete) {
          result.push(msg);
        } else {
          result.push({ role: 'assistant', content: msg.content || '(proposed a tool action)' });
        }
        continue;
      }

      result.push(msg);
    }

    return result;
  }

  private async invalidateWarehouseCache(warehouseId: string) {
    // SCAN instead of KEYS so a large cache can't block Redis.
    const toDelete: string[] = [];
    for await (const key of this.redis.raw.scanIterator({ MATCH: `cache:*:${warehouseId}:*`, COUNT: 200 })) {
      toDelete.push(key);
    }
    if (toDelete.length > 0) {
      await this.redis.raw.del(toDelete);
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
