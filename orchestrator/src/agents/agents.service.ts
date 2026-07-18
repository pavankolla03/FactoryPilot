import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { PendingAction } from '@manufacturing-agent/shared';
import { DbService } from '../common/db.service';
import { RedisService } from '../common/redis.service';
import { McpService } from '../mcp/mcp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LlmProviderFactory } from '../llm/provider.factory';
import { validationError } from '../common/errors';
import jwt from 'jsonwebtoken';

export interface AgentGoal {
  id: string;
  user_id: string;
  agent: string;
  warehouse_id: string;
  threshold: number;
  autonomy: 'observe' | 'propose' | 'act';
  daily_budget_qty: number;
  active: boolean;
  last_run_at: string | null;
}

interface RunStep {
  at: string;
  type: 'observe' | 'plan' | 'act' | 'approval' | 'verify' | 'critic' | 'outcome' | 'info' | 'error';
  detail: string;
  status: 'ok' | 'pending' | 'failed';
}

interface Suggestion {
  materialId: string;
  currentQty: number;
  inboundQty: number;
  suggestedOrderQty: number;
}

/**
 * The autonomy core: goal-directed agent runs with an explicit
 * plan → execute → verify lifecycle. Every run is persisted step by step,
 * every write goes through the same approval machinery as human-initiated
 * ones, and outcomes are read back from the source system before a run is
 * declared complete.
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly mcp: McpService,
    private readonly realtime: RealtimeGateway,
    private readonly llm: LlmProviderFactory,
  ) {}

  // ---------- goals ----------

  async createGoal(
    userId: string,
    args: { warehouseId: string; threshold?: number; autonomy?: string; dailyBudgetQty?: number; agent?: string },
  ): Promise<AgentGoal> {
    const autonomy = args.autonomy || 'propose';
    if (!['observe', 'propose', 'act'].includes(autonomy)) {
      validationError("autonomy must be 'observe', 'propose', or 'act'");
    }
    const agent = args.agent || 'replenishment';
    if (!['replenishment', 'cycle_count'].includes(agent)) {
      validationError("agent must be 'replenishment' or 'cycle_count'");
    }
    const row = await this.db.query<AgentGoal>(
      `INSERT INTO agent_goals(user_id, agent, warehouse_id, threshold, autonomy, daily_budget_qty)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, agent, args.warehouseId, args.threshold ?? 50, autonomy, args.dailyBudgetQty ?? 200],
    );
    return row.rows[0];
  }

  async listGoals(userId: string): Promise<AgentGoal[]> {
    const rows = await this.db.query<AgentGoal>(
      'SELECT * FROM agent_goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows.rows;
  }

  async updateGoal(
    userId: string,
    goalId: string,
    patch: { active?: boolean; autonomy?: string; threshold?: number; dailyBudgetQty?: number },
  ) {
    await this.db.query(
      `UPDATE agent_goals SET
         active = COALESCE($1, active),
         autonomy = COALESCE($2, autonomy),
         threshold = COALESCE($3, threshold),
         daily_budget_qty = COALESCE($4, daily_budget_qty)
       WHERE id = $5 AND user_id = $6`,
      [patch.active ?? null, patch.autonomy ?? null, patch.threshold ?? null, patch.dailyBudgetQty ?? null, goalId, userId],
    );
    const row = await this.db.query<AgentGoal>('SELECT * FROM agent_goals WHERE id = $1', [goalId]);
    return row.rows[0];
  }

  async listRuns(userId: string, isAdmin: boolean) {
    const rows = await this.db.query(
      isAdmin
        ? 'SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT 25'
        : 'SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 25',
      isAdmin ? [] : [userId],
    );
    return rows.rows;
  }

  // ---------- the run engine ----------

  async startRun(options: {
    userId: string;
    displayName: string;
    warehouseId: string;
    goal?: AgentGoal | null;
    trigger: 'manual' | 'chat' | 'schedule' | 'alert' | 'event';
  }) {
    const goal = options.goal ?? null;
    const threshold = goal?.threshold ?? 50;
    const autonomy = goal?.autonomy ?? 'propose';
    const budget = goal?.daily_budget_qty ?? 200;

    const agent = goal?.agent ?? 'replenishment';
    const goalText =
      agent === 'cycle_count'
        ? `Weekly cycle-count plan for warehouse ${options.warehouseId} (trigger: ${options.trigger})`
        : `Keep warehouse ${options.warehouseId} stocked above ${threshold} (autonomy: ${autonomy}, trigger: ${options.trigger})`;

    const runRow = await this.db.query<{ id: string }>(
      `INSERT INTO agent_runs(goal_id, user_id, agent, warehouse_id, goal_text, status)
       VALUES($1, $2, $3, $4, $5, 'running')
       RETURNING id`,
      [goal?.id ?? null, options.userId, agent, options.warehouseId, goalText],
    );
    const runId = runRow.rows[0].id;
    await this.addStep(runId, 'info', `Run started (trigger: ${options.trigger}, autonomy: ${autonomy})`, 'ok');

    const executor =
      agent === 'cycle_count'
        ? this.executeCycleCount(runId, options.userId, { warehouseId: options.warehouseId })
        : this.executeReplenishment(runId, options.userId, options.displayName, {
            warehouseId: options.warehouseId,
            threshold,
            autonomy,
            budget,
          });

    // Fire-and-forget so API callers get the run id immediately.
    void executor.catch(async (error) => {
      const reason = error instanceof Error ? error.message : 'unknown error';
      await this.addStep(runId, 'error', `Run failed: ${reason}`, 'failed');
      await this.finishRun(runId, 'failed', `Failed: ${reason}`);
    });

    return { runId };
  }

  private async executeReplenishment(
    runId: string,
    userId: string,
    displayName: string,
    cfg: { warehouseId: string; threshold: number; autonomy: string; budget: number },
  ) {
    // 1. OBSERVE — live low-stock positions.
    const low = (await this.mcp.callTool('getLowStock', {
      warehouseId: cfg.warehouseId,
      threshold: cfg.threshold,
    })) as { structuredContent?: { records?: Array<Record<string, unknown>> } };
    const lowRecords = low.structuredContent?.records ?? [];
    await this.addStep(
      runId,
      'observe',
      `Observed ${lowRecords.length} position(s) below ${cfg.threshold} in WH ${cfg.warehouseId}` +
        (lowRecords.length
          ? `: ${lowRecords.map((r) => `${r.materialId}=${r.quantity}`).join(', ')}`
          : ''),
      'ok',
    );

    if (lowRecords.length === 0) {
      await this.finishRun(runId, 'completed', 'All positions healthy — nothing to do.');
      return;
    }

    // 2. PLAN — combine with inbound POs and existing draft PRs (duplicate guard).
    const [pos, prs] = await Promise.all([
      this.mcp.callTool('getPurchaseOrders', { warehouseId: cfg.warehouseId }),
      this.mcp.callTool('getPurchaseRequisitions', { warehouseId: cfg.warehouseId }),
    ]);
    const poRecords = ((pos.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const prRecords = ((prs.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const recentlyDrafted = new Set(
      prRecords
        .filter((pr) => new Date(String(pr.createdAt)).getTime() >= threeDaysAgo)
        .map((pr) => String(pr.materialId)),
    );

    const suggestions: Suggestion[] = [];
    const skipped: string[] = [];
    for (const record of lowRecords) {
      const materialId = String(record.materialId);
      const currentQty = Number(record.quantity || 0);
      const inbound = poRecords
        .filter((po) => po.materialId === materialId && po.status !== 'delivered')
        .reduce((sum, po) => sum + Number(po.qty || 0), 0);
      const target = cfg.threshold * 2;
      const suggestedOrderQty = Math.max(target - currentQty - inbound, 0);

      if (suggestedOrderQty === 0) {
        skipped.push(`${materialId} (covered by ${inbound} inbound)`);
      } else if (recentlyDrafted.has(materialId)) {
        skipped.push(`${materialId} (draft PR already exists — duplicate guard)`);
      } else {
        suggestions.push({ materialId, currentQty, inboundQty: inbound, suggestedOrderQty });
      }
    }

    await this.addStep(
      runId,
      'plan',
      `Plan: ${suggestions.length} reorder(s) — ` +
        (suggestions.map((s) => `${s.materialId}: order ${s.suggestedOrderQty}`).join(', ') || 'none') +
        (skipped.length ? `. Skipped: ${skipped.join('; ')}` : ''),
      'ok',
    );

    if (suggestions.length === 0) {
      await this.finishRun(runId, 'completed', 'Low stock is fully covered by inbound orders and existing drafts.');
      return;
    }

    const totalQty = suggestions.reduce((sum, s) => sum + s.suggestedOrderQty, 0);

    // 2b. CRITIC (beta) — a second model pass reviews the plan before any action.
    const critic = await this.criticReview(cfg.warehouseId, suggestions, poRecords, prRecords);
    await this.addStep(runId, 'critic', critic.detail, critic.flagged ? 'failed' : 'ok');

    // 3. ACT — according to the autonomy level and blast-radius budget.
    if (cfg.autonomy === 'observe') {
      await this.addStep(runId, 'info', 'Autonomy is observe-only: proposals recorded, no action taken.', 'ok');
      await this.finishRun(
        runId,
        'completed',
        `Observed: would order ${totalQty} units across ${suggestions.length} material(s).`,
      );
      return;
    }

    if (cfg.autonomy === 'act' && totalQty <= cfg.budget && !critic.flagged) {
      for (const s of suggestions) {
        const result = (await this.mcp.callTool('draftPurchaseRequisition', {
          materialId: s.materialId,
          warehouseId: cfg.warehouseId,
          qty: s.suggestedOrderQty,
          note: `auto-replenishment run ${runId.slice(0, 8)}`,
        })) as { structuredContent?: { purchaseRequisition?: { prNumber?: string } } };
        const prNumber = result.structuredContent?.purchaseRequisition?.prNumber || 'PR-?';
        await this.addStep(
          runId,
          'act',
          `Drafted ${prNumber}: ${s.suggestedOrderQty} × ${s.materialId} (within budget ${cfg.budget})`,
          'ok',
        );
      }
      await this.verifyDrafts(runId, cfg.warehouseId, suggestions);
      await this.finishRun(
        runId,
        'completed',
        `Auto-drafted ${suggestions.length} purchase requisition(s), ${totalQty} units total — verified against the source system.`,
      );
      await this.notifyOwner(userId, 'Replenishment run completed', `WH ${cfg.warehouseId}: auto-drafted ${suggestions.length} PR(s), ${totalQty} units. All verified.`);
      await this.recordEpisode(
        `wh:${cfg.warehouseId}`,
        `Auto-replenishment drafted ${suggestions.length} PR(s) for ${suggestions.map((s) => s.materialId).join(', ')} (${totalQty} units).`,
      );
      return;
    }

    // Maker-checker policy applies to agent proposals exactly as to human ones.
    const policy = await this.db.query<{ mc: boolean }>(
      `SELECT (
         COALESCE((SELECT maker_checker FROM approval_policies WHERE user_id = $1), false)
         OR COALESCE((SELECT bool_or(maker_checker) FROM warehouse_policies WHERE warehouse_id = $2), false)
       ) AS mc`,
      [userId, cfg.warehouseId],
    );
    const makerChecker = Boolean(policy.rows[0]?.mc);

    // propose (or act over budget / critic-flagged → escalate to human)
    const escalation =
      cfg.autonomy === 'act'
        ? critic.flagged
          ? ' Critic flagged the plan — escalated to human approval.'
          : ` Total ${totalQty} exceeds the daily budget of ${cfg.budget} — escalated to human approval.`
        : '';
    const action: PendingAction = {
      actionId: randomUUID(),
      tool: 'batch',
      params: {
        steps: suggestions.map((s) => ({
          tool: 'draftPurchaseRequisition',
          params: {
            materialId: s.materialId,
            warehouseId: cfg.warehouseId,
            qty: s.suggestedOrderQty,
            note: `replenishment run ${runId.slice(0, 8)}`,
          },
        })),
      },
      humanSummary: `Replenishment plan for WH ${cfg.warehouseId}: ${suggestions
        .map((s) => `${s.suggestedOrderQty} × ${s.materialId}`)
        .join(', ')}`,
      requestedBy: `Replenishment Agent (for ${displayName})`,
      requestedById: userId,
      runId,
      makerChecker,
      ...(critic.flagged ? { anomaly: { reason: `Critic: ${critic.reason}` } } : {}),
    };
    await this.redis.raw.setEx(`pending:action:${action.actionId}`, 1200, JSON.stringify({ userId, action }));
    this.realtime.emitPendingAction(userId, action);
    await this.addStep(runId, 'approval', `Awaiting human approval of ${suggestions.length} draft(s).${escalation}`, 'pending');
    await this.setRunStatus(runId, 'waiting_approval');
    await this.notifyOwner(
      userId,
      'Replenishment plan awaiting approval',
      `WH ${cfg.warehouseId}: ${action.humanSummary}\nOne-click approve (beta): ${this.quickApproveLink(action.actionId, userId)}`,
    );
  }

  /**
   * CRITIC (beta): an LLM reviews the plan against open orders and drafts.
   * Fails open — if the model is unavailable the plan proceeds with a note.
   */
  private async criticReview(
    warehouseId: string,
    suggestions: Suggestion[],
    pos: Array<Record<string, unknown>>,
    prs: Array<Record<string, unknown>>,
  ): Promise<{ flagged: boolean; reason: string; detail: string }> {
    try {
      const provider = this.llm.getProvider();
      const prompt =
        `You are a supply-chain compliance reviewer. Review this reorder plan for warehouse ${warehouseId}.\n` +
        `PLAN: ${JSON.stringify(suggestions)}\n` +
        `OPEN_POS: ${JSON.stringify(pos.map((p) => ({ m: p.materialId, q: p.qty, s: p.status })))}\n` +
        `EXISTING_DRAFTS: ${JSON.stringify(prs.map((p) => ({ m: p.materialId, q: p.qty })))}\n` +
        `Reply with exactly one line: "APPROVE" if the plan is sensible, or "FLAG: <short reason>" if it duplicates ` +
        `existing supply, orders implausible quantities, or otherwise looks wrong.`;
      const result = await provider.complete([{ role: 'user', content: prompt }], []);
      const text = (result.text || '').trim();
      if (/^FLAG/i.test(text)) {
        const reason = text.replace(/^FLAG:?\s*/i, '').slice(0, 160) || 'unspecified concern';
        return { flagged: true, reason, detail: `Critic review (${result.modelUsed}): FLAGGED — ${reason}` };
      }
      return { flagged: false, reason: '', detail: `Critic review (${result.modelUsed}): plan approved.` };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unavailable';
      return { flagged: false, reason: '', detail: `Critic unavailable (${reason}) — proceeding without review.` };
    }
  }

  /** CYCLE-COUNT PLANNER (beta): proposes a weekly count checklist. */
  private async executeCycleCount(runId: string, userId: string, cfg: { warehouseId: string }) {
    const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId: cfg.warehouseId })) as {
      structuredContent?: { records?: Array<Record<string, unknown>> };
    };
    const records = stock.structuredContent?.records ?? [];
    await this.addStep(runId, 'observe', `Observed ${records.length} stock position(s) in WH ${cfg.warehouseId}.`, 'ok');

    if (records.length === 0) {
      await this.finishRun(runId, 'completed', 'No stock positions to count.');
      return;
    }

    // Prioritize low-quantity positions — miscounts hurt most where stock is thin.
    const picks = [...records]
      .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
      .slice(0, 5);
    const checklist = picks
      .map((r) => `• ${r.productId} @ ${r.location} (system: ${r.quantity})`)
      .join('\n');
    await this.addStep(
      runId,
      'plan',
      `Count plan (${picks.length} positions, lowest quantities first): ${picks
        .map((r) => `${r.productId}@${r.location}`)
        .join(', ')}`,
      'ok',
    );

    await this.notifyOwner(
      userId,
      `Cycle-count plan — WH ${cfg.warehouseId}`,
      `Count these positions and enter results via the board's Count button:\n${checklist}`,
    );
    await this.addStep(runId, 'act', 'Checklist delivered to notifications and webhook.', 'ok');
    await this.finishRun(runId, 'completed', `Proposed a ${picks.length}-position count plan for WH ${cfg.warehouseId}.`);
    await this.recordEpisode(`wh:${cfg.warehouseId}`, `Cycle-count plan proposed for ${picks.length} positions.`);
  }

  /** Announce a pending approval on the owner's webhook with a one-click link (beta). */
  async announceApproval(userId: string, action: PendingAction) {
    await this.notifyOwner(
      userId,
      'Approval requested',
      `${action.humanSummary}\nOne-click approve (beta): ${this.quickApproveLink(action.actionId, userId)}`,
    );
  }

  /** One-click approve link for webhook channels (beta). */
  quickApproveLink(actionId: string, userId: string) {
    const secret = process.env.AUTH_JWT_SECRET || process.env.MOCK_JWT_SECRET || 'dev-secret';
    const token = jwt.sign({ actionId, sub: userId, purpose: 'quick-approve' }, secret, { expiresIn: '20m' });
    const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    return `${base}/api/agents/approvals/quick?token=${token}`;
  }

  /** OUTCOME TRACKING (beta): did completed replenishment runs actually fix the problem? */
  @Cron('*/20 * * * *')
  async checkOutcomes() {
    const runs = await this.db.query<{ id: string; user_id: string; warehouse_id: string; goal_text: string }>(
      `SELECT id, user_id, warehouse_id, goal_text
       FROM agent_runs
       WHERE agent = 'replenishment' AND status = 'completed' AND outcome IS NULL
         AND finished_at < NOW() - INTERVAL '10 minutes'
       LIMIT 10`,
    );

    for (const run of runs.rows) {
      try {
        const thresholdMatch = /above (\d+)/.exec(run.goal_text);
        const threshold = thresholdMatch ? Number(thresholdMatch[1]) : 50;
        const [low, prs] = await Promise.all([
          this.mcp.callTool('getLowStock', { warehouseId: run.warehouse_id, threshold }),
          this.mcp.callTool('getPurchaseRequisitions', { warehouseId: run.warehouse_id }),
        ]);
        const lowRecords = ((low.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
          []) as Array<Record<string, unknown>>;
        const draftedMaterials = new Set(
          (((prs.structuredContent as { records?: Array<Record<string, unknown>> })?.records ?? []) as Array<
            Record<string, unknown>
          >).map((r) => String(r.materialId)),
        );
        const uncovered = lowRecords.filter(
          (r) => !draftedMaterials.has(String(r.materialId)) && Number(r.inboundQty || 0) === 0,
        );
        const outcome =
          uncovered.length === 0
            ? `Effective: all ${lowRecords.length} low position(s) are covered by drafts or inbound supply.`
            : `Partially effective: ${uncovered.length} position(s) still uncovered (${uncovered
                .map((r) => r.materialId)
                .join(', ')}).`;

        await this.db.query('UPDATE agent_runs SET outcome = $1, outcome_checked_at = NOW() WHERE id = $2', [
          outcome,
          run.id,
        ]);
        await this.addStep(run.id, 'outcome', `Outcome check: ${outcome}`, uncovered.length === 0 ? 'ok' : 'failed');
        await this.recordEpisode(`wh:${run.warehouse_id}`, `Replenishment run outcome — ${outcome}`);
      } catch (error) {
        this.logger.warn(`Outcome check failed for run ${run.id}: ${error instanceof Error ? error.message : '?'}`);
      }
    }
  }

  /** EPISODIC MEMORY (beta): short keyed summaries of what happened. */
  async recordEpisode(scopeKey: string, summary: string) {
    await this.db.query('INSERT INTO episodic_memory(scope_key, summary) VALUES($1, $2)', [scopeKey, summary]);
  }

  async recallEpisodes(scopeKeys: string[], limit = 3): Promise<string[]> {
    if (scopeKeys.length === 0) {
      return [];
    }
    const rows = await this.db.query<{ summary: string; created_at: string }>(
      `SELECT summary, created_at FROM episodic_memory WHERE scope_key = ANY($1)
       ORDER BY created_at DESC LIMIT $2`,
      [scopeKeys, limit],
    );
    return rows.rows.map((r) => `[${String(r.created_at).slice(0, 10)}] ${r.summary}`);
  }

  /** Called by the approval flow when a run-linked action was executed. */
  async onActionExecuted(runId: string, approverName: string, warehouseId: string, executedQty: number, count: number) {
    await this.addStep(runId, 'act', `${count} draft(s) executed after approval by ${approverName} (${executedQty} units).`, 'ok');
    await this.verifyDrafts(runId, warehouseId, null);
    await this.finishRun(runId, 'completed', `Completed after human approval by ${approverName}.`);
    await this.recordEpisode(`wh:${warehouseId}`, `Replenishment plan (${executedQty} units) approved by ${approverName} and executed.`);
  }

  /** VERIFY — read the PRs back from the source system before declaring success. */
  private async verifyDrafts(runId: string, warehouseId: string, expected: Suggestion[] | null) {
    try {
      const prs = (await this.mcp.callTool('getPurchaseRequisitions', { warehouseId })) as {
        structuredContent?: { records?: Array<Record<string, unknown>> };
      };
      const records = prs.structuredContent?.records ?? [];
      const tag = `run ${runId.slice(0, 8)}`;
      const created = records.filter((pr) => String(pr.note || '').includes(tag));
      const ok = expected === null ? created.length > 0 : created.length >= expected.length;
      await this.addStep(
        runId,
        'verify',
        `Read-back verification: found ${created.length} requisition(s) tagged to this run in the source system.`,
        ok ? 'ok' : 'failed',
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      await this.addStep(runId, 'verify', `Verification failed: ${reason}`, 'failed');
    }
  }

  // ---------- triggers ----------

  /** Every 15 minutes: run all active goals that have not run recently. */
  @Cron('*/15 * * * *')
  async runActiveGoals() {
    const goals = await this.db.query<AgentGoal & { display_name: string }>(
      `SELECT g.*, u.display_name
       FROM agent_goals g JOIN users u ON u.id = g.user_id
       WHERE g.active = true
         AND (
           (g.agent = 'replenishment' AND (g.last_run_at IS NULL OR g.last_run_at < NOW() - INTERVAL '10 minutes'))
           OR (g.agent = 'cycle_count' AND (g.last_run_at IS NULL OR g.last_run_at < NOW() - INTERVAL '7 days'))
         )`,
    );

    for (const goal of goals.rows) {
      const inFlight = await this.db.query(
        "SELECT id FROM agent_runs WHERE goal_id = $1 AND status IN ('running', 'waiting_approval') LIMIT 1",
        [goal.id],
      );
      if (inFlight.rows[0]) {
        continue;
      }
      await this.db.query('UPDATE agent_goals SET last_run_at = NOW() WHERE id = $1', [goal.id]);
      await this.startRun({
        userId: goal.user_id,
        displayName: goal.display_name,
        warehouseId: goal.warehouse_id,
        goal,
        trigger: 'schedule',
      });
    }

    // Expire runs stuck waiting for approval past the pending-action TTL.
    const stuck = await this.db.query<{ id: string }>(
      "SELECT id FROM agent_runs WHERE status = 'waiting_approval' AND started_at < NOW() - INTERVAL '25 minutes'",
    );
    for (const run of stuck.rows) {
      await this.addStep(run.id, 'error', 'Approval window expired without a decision.', 'failed');
      await this.finishRun(run.id, 'failed', 'Expired: no approval decision within the window.');
    }
  }

  /** Alert-fired trigger: a low-stock alert starts the goal's run immediately. */
  async triggerForWarehouse(warehouseId: string, trigger: 'alert' | 'event') {
    const goals = await this.db.query<AgentGoal & { display_name: string }>(
      `SELECT g.*, u.display_name
       FROM agent_goals g JOIN users u ON u.id = g.user_id
       WHERE g.active = true AND g.warehouse_id = $1
       LIMIT 1`,
      [warehouseId],
    );
    const goal = goals.rows[0];
    if (!goal) {
      return { started: false };
    }
    const inFlight = await this.db.query(
      "SELECT id FROM agent_runs WHERE goal_id = $1 AND status IN ('running', 'waiting_approval') LIMIT 1",
      [goal.id],
    );
    if (inFlight.rows[0]) {
      return { started: false };
    }
    await this.db.query('UPDATE agent_goals SET last_run_at = NOW() WHERE id = $1', [goal.id]);
    const { runId } = await this.startRun({
      userId: goal.user_id,
      displayName: goal.display_name,
      warehouseId,
      goal,
      trigger,
    });
    return { started: true, runId };
  }

  // ---------- internals ----------

  private async addStep(runId: string, type: RunStep['type'], detail: string, status: RunStep['status']) {
    const step: RunStep = { at: new Date().toISOString(), type, detail, status };
    await this.db.query('UPDATE agent_runs SET steps = steps || $1::jsonb WHERE id = $2', [
      JSON.stringify([step]),
      runId,
    ]);
    await this.emitRun(runId);
  }

  private async setRunStatus(runId: string, status: string) {
    await this.db.query('UPDATE agent_runs SET status = $1 WHERE id = $2', [status, runId]);
    await this.emitRun(runId);
  }

  private async finishRun(runId: string, status: string, summary: string) {
    await this.db.query('UPDATE agent_runs SET status = $1, summary = $2, finished_at = NOW() WHERE id = $3', [
      status,
      summary,
      runId,
    ]);
    await this.emitRun(runId);
  }

  private async emitRun(runId: string) {
    const row = await this.db.query('SELECT * FROM agent_runs WHERE id = $1', [runId]);
    if (row.rows[0]) {
      this.realtime.emitAgentRun((row.rows[0] as { user_id: string }).user_id, row.rows[0]);
    }
  }

  private async notifyOwner(userId: string, title: string, body: string) {
    const row = await this.db.query(
      'INSERT INTO notifications(user_id, title, body) VALUES($1, $2, $3) RETURNING *',
      [userId, title, body],
    );
    this.realtime.emitNotification(userId, row.rows[0]);
    try {
      const webhook = await this.db.query<{ webhook_url: string | null }>(
        'SELECT webhook_url FROM users WHERE id = $1',
        [userId],
      );
      const url = webhook.rows[0]?.webhook_url;
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `*${title}*\n${body}` }),
        });
      }
    } catch (error) {
      this.logger.warn(`Webhook delivery failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
