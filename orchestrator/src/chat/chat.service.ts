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
import type { ChatToolEvent } from '../realtime/realtime.gateway';
import { RedisService } from '../common/redis.service';
import { AlertsService } from '../alerts/alerts.service';
import { AgentsService } from '../agents/agents.service';
import { BusinessObjectsService } from '../business-objects/business-objects.service';
import { HealthService } from '../health/health.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SlottingService } from '../slotting/slotting.service';
import { hydrateModelOutcomes, reportModelOutcome } from '../llm/openrouter-provider';
import { openSecret } from '../common/secret-box';
import type { UserModelConfig } from '../llm/custom-provider';
import type { NormalizedToolCall } from '../llm/types';

const WRITE_TOOLS = new Set(['moveStock', 'draftPurchaseRequisition', 'receivePurchaseOrder', 'adjustStock', 'transferStock']);

/** Tools that mutate warehouse stock — their caches must be invalidated. */
const STOCK_MUTATING_TOOLS = new Set(['moveStock', 'receivePurchaseOrder', 'adjustStock', 'transferStock']);

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
    name: 'rememberPreference',
    description:
      "Store a lasting preference for the current user (e.g. their default warehouse, preferred threshold). Use when the user says things like 'remember that…' or 'my warehouse is…'. Key is a short snake_case name.",
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string' }, value: { type: 'string' } },
      required: ['key', 'value'],
    },
  },
  {
    name: 'scheduleReport',
    description:
      "Schedule a recurring report delivered to the user's notifications and webhook. report is 'shift_handover' or 'usage_summary'. hour is 0-23 (server time). dayOfWeek 0-6 (0=Sunday) makes it weekly; omit for daily. Use when the user asks for a report every day/week at some time.",
    inputSchema: {
      type: 'object',
      properties: {
        report: { type: 'string', enum: ['shift_handover', 'usage_summary'] },
        warehouseId: { type: 'string' },
        hour: { type: 'number' },
        dayOfWeek: { type: 'number' },
      },
      required: ['report', 'hour'],
    },
  },
  {
    name: 'listScheduledReports',
    description: "List the current user's scheduled reports.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'deleteScheduledReport',
    description: 'Delete one of the current user\'s scheduled reports by id.',
    inputSchema: {
      type: 'object',
      properties: { scheduleId: { type: 'string' } },
      required: ['scheduleId'],
    },
  },
  {
    name: 'createReplenishmentGoal',
    description:
      "Create a standing autonomous agent goal on a warehouse. agent picks the specialist: 'replenishment' (keep stock above threshold — default), 'cycle_count' (weekly count plans), 'rebalance' (move surplus to starved locations), 'po_followup' (chase overdue purchase orders), 'forecast' (demand forecast + reorder points). autonomy is 'observe', 'propose' (default), or 'act'. Use whenever the user asks for any standing/automatic behavior on a warehouse.",
    inputSchema: {
      type: 'object',
      properties: {
        warehouseId: { type: 'string' },
        agent: { type: 'string', enum: ['replenishment', 'cycle_count', 'rebalance', 'po_followup', 'forecast', 'network_rebalance'] },
        threshold: { type: 'number' },
        autonomy: { type: 'string', enum: ['observe', 'propose', 'act'] },
        dailyBudgetQty: { type: 'number' },
      },
      required: ['warehouseId'],
    },
  },
  {
    name: 'runWhatIfScenario',
    description:
      'Project a demand shock with zero writes: forecasts daily demand from live movement history, scales it by demandMultiplier (e.g. 2 = demand doubles), and projects end quantities and stockout risk per material over horizonDays. Use for questions like "what happens if demand doubles?" or "will we stock out if demand rises 50%?".',
    inputSchema: {
      type: 'object',
      properties: {
        warehouseId: { type: 'string' },
        demandMultiplier: { type: 'number' },
        horizonDays: { type: 'number' },
      },
      required: ['warehouseId', 'demandMultiplier'],
    },
  },
  {
    name: 'startReplenishmentRun',
    description:
      'Start a replenishment agent run for a warehouse right now: it observes low stock, plans reorders, acts per policy, and verifies the result. Use when the user asks to run replenishment or check-and-reorder now.',
    inputSchema: {
      type: 'object',
      properties: { warehouseId: { type: 'string' } },
      required: ['warehouseId'],
    },
  },
  {
    name: 'listAgentRuns',
    description: "List recent autonomous agent runs with their status and outcome.",
    inputSchema: { type: 'object', properties: {} },
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
  {
    name: 'suggestSlotting',
    description:
      'Analyze pick frequency (7 days of movements) for a warehouse and propose bin relocations: fast-moving materials sitting in reserve locations (bulk/receiving) that should move to a forward pick face (packing/shipping) for a shorter pick path. Use for "how can we optimize slotting/picking?", "which materials are in the wrong location?", "reduce picker walking". Returns ranked relocation proposals with rationale; each can be executed as a governed move.',
    inputSchema: {
      type: 'object',
      properties: { warehouseId: { type: 'string' } },
      required: ['warehouseId'],
    },
  },
  {
    name: 'getSupplierScorecards',
    description:
      'Get supplier reliability scorecards ranked worst-first: on-time delivery rate, lead time (declared and measured from PO history), open and overdue purchase orders, quantity on order, and a 0-100 reliability score. Use for questions about suppliers/vendors — "which supplier is our biggest risk?", "who has the worst on-time rate or longest lead time?", "which supplier has overdue POs?". Takes no arguments; returns all suppliers in scope.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getWarehouseHealth',
    description:
      'Get the composite health score (0-100) for a warehouse with its factor breakdown — days-of-cover, low stock, PO aging and movement anomalies — plus trend and the biggest detractor. Use for "are we OK?", "how healthy is warehouse X?", "why is the score low?", or to investigate/explain a warehouse\'s health. Returns the factors so you can name the biggest risk and recommend an action (reorder, chase POs, investigate a move).',
    inputSchema: {
      type: 'object',
      properties: { warehouseId: { type: 'string' } },
      required: ['warehouseId'],
    },
  },
  {
    name: 'queryBusinessObject',
    description:
      'Query a registered SAP business object via the metadata-driven OData registry and get a contextualized summary (status counts, breakdowns, overdue/today/upcoming buckets) plus the records. objectCode options: SALES (sales orders), DELIVERY (outbound deliveries), SHIPPING (shipments by carrier/route), GOODS_MOVEMENT (SAP material documents / postings, movement types like 101 receipt and 601 issue — use this for "goods movements", "postings", "material documents", NOT for simple stock moves), PURCHASING (purchase orders). Set todayOnly=true for "today" questions (e.g. "orders to be delivered today"). Pass warehouseId when a warehouse/plant is named or implied. Use the returned summary object to answer questions about how many are shipped/pending/overdue or which carrier/supplier — do not call other tools for that.',
    inputSchema: {
      type: 'object',
      properties: {
        objectCode: { type: 'string' },
        warehouseId: { type: 'string' },
        todayOnly: { type: 'boolean' },
      },
      required: ['objectCode'],
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
    private readonly agents: AgentsService,
    private readonly businessObjects: BusinessObjectsService,
    private readonly health: HealthService,
    private readonly suppliers: SuppliersService,
    private readonly slotting: SlottingService,
  ) {}

  async getUsage(userId: string) {
    return this.quota.getUsage(userId);
  }

  async chat(
    user: AuthUser,
    conversationId: string | undefined,
    message: string,
    channel: 'chat' | 'api' = 'chat',
  ): Promise<ChatResponse> {
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
        channel,
        errorDetail: `${quotaState.window} token limit reached`,
      });
      quotaExceeded(`${quotaState.resetAt} (${quotaState.window} limit)`);
    }
    if (quotaState.warned) {
      // Overage policy 'warn': allow the request but notify once per window per day.
      void this.notifyQuotaOverage(user.id, quotaState.window ?? 'monthly');
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
        stats: { elapsedMs: Date.now() - start, rounds: 0, toolCount: 0, model: 'answer-cache', tokens: 0 },
        toolEvents: [],
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
        channel,
        model: 'answer-cache',
      });
      return { conversationId: convId, messageId: msgId, text: cached.text, source: 'cache', grounded: cached.grounded };
    }

    const tools = [...this.mcp.listTools(), ...LOCAL_TOOLS];
    const prefsRow = await this.db.query<{ preferences: Record<string, string> }>(
      'SELECT preferences FROM users WHERE id = $1',
      [user.id],
    );
    const preferences = prefsRow.rows[0]?.preferences || {};
    const preferenceNote = Object.keys(preferences).length
      ? ` Known user preferences (apply as defaults unless overridden): ${JSON.stringify(preferences)}.`
      : '';

    // Episodic memory (beta): recall recent history for warehouses in play.
    const mentionedWarehouses = [...new Set([...(message.match(/\b10[1-5]0\b/g) || []), preferences.default_warehouse].filter(Boolean))];
    const orgPrefix = `org:${user.orgId ?? 'default'}:`;
    const episodes = await this.agents.recallEpisodes(mentionedWarehouses.map((w) => `${orgPrefix}wh:${w}`));
    const episodeNote = episodes.length
      ? ` Relevant recent history: ${episodes.join(' | ')}`
      : '';

    // Registered business objects (spec App #1): tell Otto which objectCodes the
    // metadata-driven queryBusinessObject tool can answer, and their keywords.
    const businessObjects = await this.businessObjects.activeObjects(user).catch(() => []);
    const businessObjectNote = businessObjects.length
      ? ` Registered SAP business objects for queryBusinessObject (objectCode — name — keywords): ${businessObjects
          .map((b) => `${b.code} — ${b.name} — ${b.keywords}`)
          .join('; ')}. Route order/delivery/shipping/goods-movement/purchasing questions to queryBusinessObject with the matching objectCode.`
      : '';
    const systemPrompt =
      "You are Otto, FactoryPilot's warehouse copilot for SAP manufacturing. " +
      'Style: open with a one-sentence direct answer, then add structure only when it helps — markdown tables for records, ' +
      'short bullet lists for breakdowns, **bold** for key figures. Be warm but concise; no filler phrases. ' +
      'When numbers come from tools, use them exactly — never invent or round data. ' +
      'Rules: always include warehouseId for warehouse-touching tools; if warehouseId is unknown, ask instead of guessing. ' +
      'Never claim a write action has already completed before confirmation. ' +
      'Invoke tools ONLY through the function-calling mechanism; never print a JSON tool call as text. ' +
      'Copy parameter values exactly as the user stated them (e.g. location names like "packing" or "shipping"). ' +
      'You can create stock alerts (createStockAlert) when the user asks to be notified about stock levels.' +
      preferenceNote +
      episodeNote +
      businessObjectNote;

    const conversationHistory = await this.getConversationMessages(convId);
    const llmMessages: LlmChatMessage[] = [{ role: 'system', content: systemPrompt }, ...conversationHistory];

    // BYOM (beta): route to the user's own registered models first.
    const provider = this.providerFactory.getProviderForUser(user.id, await this.userModelConfigs(user.id));
    let source: 'cache' | 'live' = 'live';
    const invokedTools: string[] = [];
    let finalText = '';
    let totalTokens = 0;
    let lastModelUsed = '';
    let streamedChars = 0;
    const toolEvents: ChatToolEvent[] = [];
    let roundsUsed = 0;
    let llmMs = 0;
    let payloadBytes = 0;
    const toolMs = () => toolEvents.reduce((sum, e) => sum + (e.ms || 0), 0);
    const statsNow = () => ({
      elapsedMs: Date.now() - start,
      rounds: roundsUsed,
      toolCount: invokedTools.length,
      model: lastModelUsed || 'fallback',
      tokens: totalTokens,
    });

    const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    const onTextDelta = (delta: string) => {
      streamedChars += delta.length;
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta });
    };

    try {
      for (let round = 0; round < 8; round += 1) {
        roundsUsed = round + 1;
        this.realtime.emitChatStatus(user.id, { conversationId: convId, kind: 'thinking', round: round + 1 });
        let completion;
        const llmStart = Date.now();
        try {
          completion = provider.completeStream
            ? await provider.completeStream(llmMessages, toolDefs, onTextDelta)
            : await provider.complete(llmMessages, toolDefs);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'unknown error';
          this.logger.warn(`LLM provider call failed, using keyword fallback: ${reason}`);
          return this.handleFallbackWithoutLlm(user, convId, message, start, invokedTools);
        }
        llmMs += Date.now() - llmStart;

        if (!completion.toolCalls?.length) {
          const salvaged = this.salvageToolCallFromText(completion.text);
          if (salvaged) {
            this.logger.warn(`Salvaged tool call ${salvaged.name} from plain-text model output`);
            completion = { ...completion, toolCalls: [salvaged], text: '' };
          }
        }

        lastModelUsed = completion.modelUsed;
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
          // Some models emit a bare newline/whitespace as text alongside tool
          // calls. Persist it as empty so it never renders as a blank Otto turn.
          const assistantText = completion.text?.trim() ? completion.text : '';
          await this.insertMessage(convId, 'assistant', assistantText, completion.toolCalls);

          const writeCalls: NormalizedToolCall[] = [];

          for (const call of completion.toolCalls) {
            invokedTools.push(call.name);

            const toolDesc = this.getToolDescriptor(call.name);
            const warehouseId = (call.arguments.warehouseId as string | undefined) || undefined;
            if (call.name === 'transferStock') {
              // Inter-warehouse transfer touches two warehouses — write scope on both.
              this.assertScope(user, String(call.arguments.fromWarehouseId || ''), 'write');
              this.assertScope(user, String(call.arguments.toWarehouseId || ''), 'write');
            } else if (this.requiresWarehouseScope(toolDesc?.inputSchema)) {
              this.assertScope(user, warehouseId, WRITE_TOOLS.has(call.name) ? 'write' : 'read');
            }

            if (WRITE_TOOLS.has(call.name)) {
              writeCalls.push(call);
              continue;
            }

            const stepId = randomUUID();
            const server = this.isLocalTool(call.name)
              ? 'orchestrator'
              : this.mcp.getTool(call.name)?.serverName || 'mcp';
            this.realtime.emitChatStatus(user.id, {
              conversationId: convId,
              kind: 'tool_start',
              id: stepId,
              tool: call.name,
              server,
              args: call.arguments,
            });
            const toolStart = Date.now();
            let data: unknown;
            let cacheHit = false;
            try {
              ({ data, cacheHit } = this.isLocalTool(call.name)
                ? { data: await this.executeLocalTool(user, call.name, call.arguments), cacheHit: false }
                : await this.readToolWithCache(call.name, call.arguments, user.id));
            } catch (error) {
              const failed: ChatToolEvent = {
                id: stepId,
                tool: call.name,
                server,
                args: call.arguments,
                ms: Date.now() - toolStart,
                status: 'error',
              };
              toolEvents.push(failed);
              this.realtime.emitChatStatus(user.id, { conversationId: convId, kind: 'tool_end', ...failed });
              throw error;
            }
            const event: ChatToolEvent = {
              id: stepId,
              tool: call.name,
              server,
              args: call.arguments,
              ms: Date.now() - toolStart,
              cacheHit,
              status: 'ok',
            };
            toolEvents.push(event);
            this.realtime.emitChatStatus(user.id, { conversationId: convId, kind: 'tool_end', ...event });
            source = cacheHit ? 'cache' : source;
            const toolContent = JSON.stringify(data);
            payloadBytes += toolContent.length;
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
                const stepId = randomUUID();
                const server = this.mcp.getTool(call.name)?.serverName || 'mcp-warehouse-ops';
                this.realtime.emitChatStatus(user.id, {
                  conversationId: convId,
                  kind: 'tool_start',
                  id: stepId,
                  tool: call.name,
                  server,
                  args: call.arguments,
                });
                const toolStart = Date.now();
                const result = await this.executeWriteTool(call.name, call.arguments);
                const event: ChatToolEvent = {
                  id: stepId,
                  tool: call.name,
                  server,
                  args: call.arguments,
                  ms: Date.now() - toolStart,
                  cacheHit: false,
                  status: 'ok',
                };
                toolEvents.push(event);
                this.realtime.emitChatStatus(user.id, { conversationId: convId, kind: 'tool_end', ...event });
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
            void this.agents.announceApproval(user.id, action);

            const assistantText =
              writeCalls.length === 1
                ? 'I prepared a write action. Please confirm to execute.'
                : `I prepared ${writeCalls.length} write actions as one workflow. Please confirm to execute.`;
            // Surface the deferred writes in the activity timeline as awaiting approval.
            for (const call of writeCalls) {
              const event: ChatToolEvent = {
                id: randomUUID(),
                tool: call.name,
                server: this.mcp.getTool(call.name)?.serverName || 'mcp-warehouse-ops',
                args: call.arguments,
                status: 'pending',
              };
              toolEvents.push(event);
              this.realtime.emitChatStatus(user.id, { conversationId: convId, kind: 'tool_end', ...event });
            }

            await this.insertMessage(convId, 'assistant', assistantText);
            const msgId = randomUUID();
            this.realtime.emitChatToken(user.id, { conversationId: convId, delta: assistantText });
            this.realtime.emitChatDone(user.id, {
              conversationId: convId,
              messageId: msgId,
              source: 'live',
              stats: statsNow(),
              toolEvents,
            });

            await this.writeSessionLog({
              userId: user.id,
              conversationId: convId,
              queryText: message,
              toolsInvoked: invokedTools,
              cacheStatus: 'n/a',
              tokensUsed: totalTokens,
              status: 'success',
              latencyMs: Date.now() - start,
              channel,
              model: lastModelUsed,
              toolMs: toolMs(),
              llmMs,
              payloadBytes,
              toolsDetail: toolEvents,
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
        channel,
        model: lastModelUsed,
        toolMs: toolMs(),
        llmMs,
        payloadBytes,
        errorDetail: messageText,
        toolsDetail: toolEvents,
      });
      throw error;
    }

    if (!finalText) {
      finalText = "I wasn't able to complete that — could you rephrase?";
    }

    await this.insertMessage(convId, 'assistant', finalText);
    const messageId = randomUUID();
    const grounded = invokedTools.length > 0;
    // Outcome-driven routing signal (beta, Phase K): a model call counts as
    // "good" when it grounded the answer in tools or produced a final text.
    if (lastModelUsed) {
      reportModelOutcome(lastModelUsed, grounded || Boolean(finalText));
      void this.redis.raw
        .hIncrBy(`model:quality:${lastModelUsed}`, 'total', 1)
        .then(() => (grounded || finalText ? this.redis.raw.hIncrBy(`model:quality:${lastModelUsed}`, 'ok', 1) : null))
        .catch(() => undefined);
    }
    if (streamedChars === 0) {
      // Non-streaming provider: emit the full text as a single chunk.
      this.realtime.emitChatToken(user.id, { conversationId: convId, delta: finalText });
    }
    this.realtime.emitChatDone(user.id, {
      conversationId: convId,
      messageId,
      source,
      grounded,
      stats: statsNow(),
      toolEvents,
    });

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
      channel,
      model: lastModelUsed,
      toolMs: toolMs(),
      llmMs,
      payloadBytes,
      toolsDetail: toolEvents,
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
      if (step.tool === 'transferStock') {
        // Inter-warehouse transfer touches two warehouses — write scope on both.
        this.assertScope(user, String(step.params.fromWarehouseId || ''), 'write');
        this.assertScope(user, String(step.params.toWarehouseId || ''), 'write');
      } else {
        this.assertScope(user, step.params.warehouseId as string | undefined, 'write');
      }
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

    if (payload.action.runId) {
      const executedQty = steps.reduce((sum, s) => sum + Number(s.params.qty || 0), 0);
      const warehouseId = String(steps[0]?.params.warehouseId || '');
      await this.agents.onActionExecuted(payload.action.runId, user.displayName, warehouseId, executedQty, steps.length);
    }

    return { success: true, actionId, result: steps.length === 1 ? results[0] : { steps: results } };
  }

  /** Live stock for the kanban operations board (scope-checked, cached). */
  async getWarehouseBoard(user: AuthUser, warehouseId: string) {
    if (!warehouseId) {
      validationError('warehouseId is required');
    }
    this.assertScope(user, warehouseId, 'read');

    const { data, cacheHit } = await this.readToolWithCache('listWarehouseStock', { warehouseId }, user.id);
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
        channel: 'board',
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
      channel: 'board',
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: 0,
    });

    return { executed: false, pendingAction: action };
  }

  /**
   * Cycle-count adjustment from the board. Always requires approval —
   * inventory adjustments are audit-sensitive regardless of size.
   */
  async proposeAdjust(
    user: AuthUser,
    params: { warehouseId: string; productId: string; location: string; countedQty: number; systemQty: number },
  ) {
    this.assertScope(user, params.warehouseId, 'write');
    const delta = params.countedQty - params.systemQty;

    const action: PendingAction = {
      actionId: randomUUID(),
      tool: 'adjustStock',
      params: {
        productId: params.productId,
        warehouseId: params.warehouseId,
        location: params.location,
        targetQty: params.countedQty,
        reason: `cycle count: system ${params.systemQty}, counted ${params.countedQty} (${delta >= 0 ? '+' : ''}${delta})`,
      },
      humanSummary: `Cycle count: set ${params.productId} at ${params.location} (WH ${params.warehouseId}) to ${params.countedQty} — system shows ${params.systemQty} (${delta >= 0 ? '+' : ''}${delta})`,
      requestedBy: user.displayName,
      requestedById: user.id,
      makerChecker: (await this.resolveWritePolicy(user.id, [params.warehouseId])).makerChecker,
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
      queryText: `cycle-count:${params.productId}@${params.location} ${params.systemQty}→${params.countedQty}`,
      toolsInvoked: ['adjustStock'],
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

    if (STOCK_MUTATING_TOOLS.has(tool)) {
      if (tool === 'transferStock') {
        const from = String(params.fromWarehouseId || 'global');
        const to = String(params.toWarehouseId || 'global');
        await this.invalidateWarehouseCache(from);
        await this.invalidateWarehouseCache(to);
        const transfer = ((result?.structuredContent || result) as { transfer?: { outbound?: unknown; inbound?: unknown } })
          .transfer;
        if (transfer?.outbound) {
          await this.redis.raw.zAdd(`cache:movements:${from}`, { score: Date.now(), value: JSON.stringify(transfer.outbound) });
        }
        if (transfer?.inbound) {
          await this.redis.raw.zAdd(`cache:movements:${to}`, { score: Date.now(), value: JSON.stringify(transfer.inbound) });
        }
      } else {
        const warehouse = String(params.warehouseId || 'global');
        await this.invalidateWarehouseCache(warehouse);
        const structured = (result?.structuredContent || result) as { movement?: unknown };
        if (structured.movement) {
          await this.redis.raw.zAdd(`cache:movements:${warehouse}`, {
            score: Date.now(),
            value: JSON.stringify(structured),
          });
        }
      }
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

    if (name === 'rememberPreference') {
      const key = String(args.key || '').trim();
      const value = String(args.value || '').trim();
      if (!key || !value) {
        validationError('key and value are required');
      }
      await this.db.query(
        'UPDATE users SET preferences = preferences || jsonb_build_object($1::text, $2::text) WHERE id = $3',
        [key, value, user.id],
      );
      return { structuredContent: { remembered: true, key, value } };
    }

    if (name === 'scheduleReport') {
      const schedule = await this.alerts.createSchedule(user.id, {
        report: String(args.report || 'shift_handover'),
        warehouseId: args.warehouseId ? String(args.warehouseId) : null,
        hour: Number(args.hour),
        dayOfWeek: args.dayOfWeek === undefined || args.dayOfWeek === null ? null : Number(args.dayOfWeek),
      });
      return {
        structuredContent: {
          scheduled: true,
          schedule,
          note: 'Delivered to notifications and the user webhook if configured. Hours are server time (24h).',
        },
      };
    }

    if (name === 'listScheduledReports') {
      return { structuredContent: { records: await this.alerts.listSchedules(user.id) } };
    }

    if (name === 'deleteScheduledReport') {
      return { structuredContent: await this.alerts.deleteSchedule(user.id, String(args.scheduleId || '')) };
    }

    if (name === 'runWhatIfScenario') {
      this.assertScope(user, String(args.warehouseId || ''), 'read');
      const result = await this.agents.simulateScenario(
        user.id,
        String(args.warehouseId),
        50,
        Math.min(Math.max(Number(args.demandMultiplier) || 1, 0.1), 10),
        Math.min(Math.max(Number(args.horizonDays) || 14, 1), 90),
      );
      return { structuredContent: result };
    }

    if (name === 'createReplenishmentGoal') {
      this.assertScope(user, String(args.warehouseId || ''), 'write');
      const goal = await this.agents.createGoal(user.id, {
        warehouseId: String(args.warehouseId),
        agent: args.agent ? String(args.agent) : undefined,
        threshold: args.threshold !== undefined ? Number(args.threshold) : undefined,
        autonomy: args.autonomy ? String(args.autonomy) : undefined,
        dailyBudgetQty: args.dailyBudgetQty !== undefined ? Number(args.dailyBudgetQty) : undefined,
      });
      return {
        structuredContent: {
          created: true,
          goal: {
            id: goal.id,
            warehouseId: goal.warehouse_id,
            threshold: goal.threshold,
            autonomy: goal.autonomy,
            dailyBudgetQty: goal.daily_budget_qty,
          },
          note: 'The agent checks this goal every 15 minutes and whenever a stock alert fires. Manage it in the Autonomy tab.',
        },
      };
    }

    if (name === 'startReplenishmentRun') {
      this.assertScope(user, String(args.warehouseId || ''), 'write');
      const goals = await this.agents.listGoals(user.id);
      const goal = goals.find((g) => g.warehouse_id === String(args.warehouseId) && g.active) ?? null;
      const { runId } = await this.agents.startRun({
        userId: user.id,
        displayName: user.displayName,
        warehouseId: String(args.warehouseId),
        goal,
        trigger: 'chat',
      });
      return {
        structuredContent: {
          started: true,
          runId,
          note: 'The run executes in the background — progress appears in the Autonomy tab in real time.',
        },
      };
    }

    if (name === 'listAgentRuns') {
      const runs = (await this.agents.listRuns(user.id, user.role === 'admin')) as Array<Record<string, unknown>>;
      return {
        structuredContent: {
          records: runs.slice(0, 10).map((r) => ({
            id: r.id,
            warehouseId: r.warehouse_id,
            status: r.status,
            goal: r.goal_text,
            summary: r.summary,
            startedAt: r.started_at,
          })),
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

    if (name === 'suggestSlotting') {
      const warehouseId = String(args.warehouseId || '');
      this.assertScope(user, warehouseId, 'read');
      const result = await this.slotting.proposals(warehouseId);
      return {
        structuredContent: {
          ...result,
          count: result.proposals.length,
          note: 'Each proposal is a governed move — use moveStock (or the operations board) to execute it with approval.',
        },
      };
    }

    if (name === 'getSupplierScorecards') {
      const cards = await this.suppliers.scorecards(user);
      return { structuredContent: { count: cards.length, records: cards } };
    }

    if (name === 'getWarehouseHealth') {
      const warehouseId = String(args.warehouseId || '');
      this.assertScope(user, warehouseId, 'read');
      const health = await this.health.detail(user, warehouseId);
      return { structuredContent: health };
    }

    if (name === 'queryBusinessObject') {
      const warehouseId = args.warehouseId ? String(args.warehouseId) : undefined;
      if (warehouseId) {
        this.assertScope(user, warehouseId, 'read');
      }
      const result = await this.businessObjects.query(user, {
        objectCode: String(args.objectCode || '').trim().toUpperCase(),
        warehouseId,
        todayOnly: Boolean(args.todayOnly),
        top: args.top !== undefined ? Number(args.top) : undefined,
      });
      return {
        structuredContent: {
          objectCode: result.objectCode,
          objectName: result.objectName,
          dataSource: result.dataSource,
          count: result.records.length,
          // Contextualization (spec Component 5): pre-computed business rollups
          // so the answer can cite status/breakdown/overdue without more tool calls.
          summary: result.summary,
          records: result.records,
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

  /** Emit a grounded, LLM-free assistant answer (used by the fallback intents). */
  private async emitFallbackText(
    user: AuthUser,
    convId: string,
    message: string,
    start: number,
    text: string,
    tools: string[],
  ): Promise<ChatResponse> {
    await this.insertMessage(convId, 'assistant', text);
    const msgId = randomUUID();
    this.realtime.emitChatToken(user.id, { conversationId: convId, delta: text });
    this.realtime.emitChatDone(user.id, { conversationId: convId, messageId: msgId, source: 'live', grounded: true });
    await this.writeSessionLog({
      userId: user.id,
      conversationId: convId,
      queryText: message,
      toolsInvoked: tools,
      cacheStatus: 'n/a',
      tokensUsed: 0,
      status: 'success',
      latencyMs: Date.now() - start,
    });
    return { conversationId: convId, messageId: msgId, text, source: 'live', grounded: true };
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

    // Grounded intelligence answers work without the LLM (data is computed, not
    // generated) — so the Insights "Explain" buttons stay reliable during a
    // free-model outage.
    if (lower.includes('health') && warehouseId) {
      try {
        this.assertScope(user, warehouseId, 'read');
        const h = await this.health.detail(user, warehouseId);
        const action: Record<string, string> = {
          'Days of cover': 'Replenish the low-cover materials (draft a purchase requisition) to restore 3+ days of cover.',
          'Low stock': 'Review the low-stock positions and reorder what is below threshold.',
          'PO aging': 'Chase the overdue purchase orders with the supplier.',
          'Movement anomalies': 'Investigate the unusually large movements in the Activity audit trail.',
        };
        const trend = h.trend === null || h.trend === 0 ? '' : ` (${h.trend > 0 ? '▲ +' : '▼ '}${Math.abs(h.trend)} vs yesterday)`;
        const text =
          `**Warehouse ${warehouseId} health: ${h.score}/100 — ${h.band}**${trend}\n\n` +
          (h.detractor
            ? `Biggest risk — **${h.detractor.label}**: ${h.detractor.detail}\n\n**What to do:** ${action[h.detractor.label] ?? 'Review the factor breakdown below.'}\n\n`
            : 'All factors are healthy.\n\n') +
          h.factors.map((f) => `- ${f.label}: **${f.score}** — ${f.detail}`).join('\n');
        return this.emitFallbackText(user, convId, message, start, text, ['getWarehouseHealth']);
      } catch {
        /* fall through to generic */
      }
    }

    if (lower.includes('supplier')) {
      try {
        const cards = await this.suppliers.scorecards(user);
        if (cards.length) {
          const top = cards[0];
          const text =
            `**${top.name}** is the biggest reliability risk: **${top.reliabilityScore}/100 (${top.band})** — ` +
            `on-time ${top.onTimeRatePct ?? '—'}%, lead time ${top.leadTimeDays ?? '—'}d` +
            `${top.overduePOs ? `, ${top.overduePOs} overdue PO(s)` : ''}.\n\n` +
            'Worst-ranked suppliers:\n' +
            cards
              .slice(0, 5)
              .map((c) => `- **${c.name}** — ${c.reliabilityScore}/100 (${c.band}); on-time ${c.onTimeRatePct ?? '—'}%, lead ${c.leadTimeDays ?? '—'}d${c.overduePOs ? `, ${c.overduePOs} overdue` : ''}`)
              .join('\n') +
            '\n\n**What to do:** line up a backup source for the top risk and tighten PO follow-up on overdue orders.';
          return this.emitFallbackText(user, convId, message, start, text, ['getSupplierScorecards']);
        }
      } catch {
        /* fall through */
      }
    }

    if ((lower.includes('slot') || lower.includes('reslot') || lower.includes('pick')) && warehouseId) {
      try {
        this.assertScope(user, warehouseId, 'read');
        const { proposals } = await this.slotting.proposals(warehouseId);
        const text = proposals.length
          ? `**Slotting for warehouse ${warehouseId}** — ${proposals.length} relocation(s) to shorten pick paths:\n\n` +
            proposals
              .slice(0, 5)
              .map((p) => `- **${p.productId}** ${p.fromLocation} → ${p.toLocation} (${p.qty} units) — picked ${p.picks}× in 7 days\n  ${p.rationale}`)
              .join('\n') +
            '\n\nEach can be executed as a governed move from the Insights tab or the Operations Board.'
          : `No relocation opportunities in warehouse ${warehouseId} — fast movers are already on forward pick faces.`;
        return this.emitFallbackText(user, convId, message, start, text, ['suggestSlotting']);
      } catch {
        /* fall through */
      }
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

  /** Per-tool cache policies (spec alignment), admin-editable, refreshed every 30s. */
  private cachePolicyState: {
    at: number;
    map: Map<string, { enabled: boolean; ttl_seconds: number | null; key_strategy: string }>;
  } = { at: 0, map: new Map() };

  private async getCachePolicy(toolName: string) {
    if (Date.now() - this.cachePolicyState.at > 30_000) {
      try {
        const rows = await this.db.query<{
          tool_name: string;
          enabled: boolean;
          ttl_seconds: number | null;
          key_strategy: string;
        }>('SELECT tool_name, enabled, ttl_seconds, key_strategy FROM cache_policies');
        this.cachePolicyState = { at: Date.now(), map: new Map(rows.rows.map((r) => [r.tool_name, r])) };
      } catch {
        this.cachePolicyState.at = Date.now(); // table may not exist yet — fall back to defaults
      }
    }
    return this.cachePolicyState.map.get(toolName);
  }

  private async readToolWithCache(toolName: string, params: Record<string, unknown>, userId?: string) {
    if (toolName === 'getRecentMovements') {
      const live = await this.mcp.callTool(toolName, params);
      return { data: live, cacheHit: false };
    }

    const policy = await this.getCachePolicy(toolName);
    if (policy && !policy.enabled) {
      const live = await this.mcp.callTool(toolName, params);
      return { data: live, cacheHit: false };
    }

    const warehouseKey = (params.warehouseId as string | undefined) || 'global';
    const paramsHash = this.sortedHash(params);
    // per_user strategy keeps the user segment after the warehouse so the
    // warehouse-wide invalidation pattern (cache:*:{wh}:*) still matches.
    const userPart = policy?.key_strategy === 'per_user' && userId ? `u:${userId}:` : '';
    const cacheKey = `cache:${toolName}:${warehouseKey}:${userPart}${paramsHash}`;

    const hit = await this.redis.raw.get(cacheKey);
    if (hit) {
      return { data: JSON.parse(hit), cacheHit: true };
    }

    const live = await this.mcp.callTool(toolName, params);
    await this.redis.raw.setEx(cacheKey, policy?.ttl_seconds || this.cacheTtlSeconds, JSON.stringify(live));
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
    channel?: 'chat' | 'api' | 'board';
    model?: string;
    toolMs?: number;
    llmMs?: number;
    payloadBytes?: number;
    errorDetail?: string;
    toolsDetail?: unknown;
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
          latency_ms,
          channel,
          model,
          tool_ms,
          llm_ms,
          payload_bytes,
          error_detail,
          tools_detail
       ) VALUES($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
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
        args.channel ?? 'chat',
        args.model || null,
        args.toolMs ?? null,
        args.llmMs ?? null,
        args.payloadBytes ?? null,
        args.errorDetail || null,
        args.toolsDetail ? JSON.stringify(args.toolsDetail) : null,
      ],
    );

    this.realtime.emitSessionLog(row.rows[0]);
  }

  /** Overage policy 'warn': one in-app notification per breached window per day. */
  private async notifyQuotaOverage(userId: string, window: string) {
    try {
      const key = `quota:warned:${userId}:${window}:${new Date().toISOString().slice(0, 10)}`;
      const first = await this.redis.raw.set(key, '1', { NX: true, EX: 86400 });
      if (first !== 'OK') {
        return;
      }
      const row = await this.db.query(
        'INSERT INTO notifications(user_id, title, body) VALUES($1, $2, $3) RETURNING *',
        [
          userId,
          'Token budget exceeded',
          `You are over your ${window} token budget. Requests are still allowed because your overage policy is set to "warn".`,
        ],
      );
      this.realtime.emitNotification(userId, row.rows[0]);
    } catch {
      // Never let a courtesy warning break the chat path.
    }
  }

  /** Outcome-routing ledger survives restarts: rebuild it from Redis at boot. */
  async onModuleInit() {
    try {
      const entries: Array<{ model: string; total: number; ok: number }> = [];
      for await (const key of this.redis.raw.scanIterator({ MATCH: 'model:quality:*', COUNT: 100 })) {
        const h = await this.redis.raw.hGetAll(key);
        entries.push({ model: key.replace('model:quality:', ''), total: Number(h.total || 0), ok: Number(h.ok || 0) });
      }
      hydrateModelOutcomes(entries);
    } catch {
      // Redis not up yet — the ledger simply starts cold.
    }
  }

  private readonly userModelCache = new Map<string, { at: number; configs: UserModelConfig[] }>();

  /** Active BYOM configs with decrypted keys, cached 60s (beta, Phase M). */
  private async userModelConfigs(userId: string): Promise<UserModelConfig[]> {
    const cached = this.userModelCache.get(userId);
    if (cached && Date.now() - cached.at < 60_000) {
      return cached.configs;
    }
    const rows = await this.db.query<{ id: string; name: string; base_url: string; model_id: string; api_key_enc: string }>(
      "SELECT id, name, base_url, model_id, api_key_enc FROM user_models WHERE user_id = $1 AND active = true AND purpose = 'chat' ORDER BY created_at ASC",
      [userId],
    );
    const configs: UserModelConfig[] = [];
    for (const r of rows.rows) {
      try {
        configs.push({ id: r.id, name: r.name, baseUrl: r.base_url, modelId: r.model_id, apiKey: openSecret(r.api_key_enc) });
      } catch {
        // sealed under a rotated secret — skip
      }
    }
    if (configs.length > 0) {
      void this.db
        .query('UPDATE user_models SET last_used_at = NOW() WHERE user_id = $1 AND active = true', [userId])
        .catch(() => undefined);
    }
    this.userModelCache.set(userId, { at: Date.now(), configs });
    return configs;
  }
}
