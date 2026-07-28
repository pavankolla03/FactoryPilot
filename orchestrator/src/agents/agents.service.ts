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
import { holtForecast, reorderPoint, toDailySeries } from './forecast';
import { openSecret } from '../common/secret-box';
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
    if (!['replenishment', 'cycle_count', 'rebalance', 'po_followup', 'forecast', 'network_rebalance'].includes(agent)) {
      validationError("agent must be one of: replenishment, cycle_count, rebalance, po_followup, forecast, network_rebalance");
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
    // Admins see their whole organization's runs, never another tenant's (beta multi-tenancy).
    const rows = await this.db.query(
      isAdmin
        ? `SELECT r.* FROM agent_runs r JOIN users u ON u.id = r.user_id
           WHERE u.org_id = (SELECT org_id FROM users WHERE id = $1)
           ORDER BY r.started_at DESC LIMIT 25`
        : 'SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 25',
      [userId],
    );
    return rows.rows;
  }

  // ---------- the run engine ----------

  async startRun(options: {
    userId: string;
    displayName: string;
    warehouseId: string;
    goal?: AgentGoal | null;
    trigger: 'manual' | 'chat' | 'schedule' | 'alert' | 'event' | 'autopilot';
  }) {
    const goal = options.goal ?? null;
    const threshold = goal?.threshold ?? 50;
    const autonomy = goal?.autonomy ?? 'propose';
    const budget = goal?.daily_budget_qty ?? 200;

    const agent = goal?.agent ?? 'replenishment';
    const goalText =
      agent === 'cycle_count'
        ? `Weekly cycle-count plan for warehouse ${options.warehouseId} (trigger: ${options.trigger})`
        : agent === 'po_followup'
          ? `Chase overdue purchase orders for warehouse ${options.warehouseId} (trigger: ${options.trigger})`
        : agent === 'forecast'
          ? `Weekly demand forecast + reorder points for warehouse ${options.warehouseId} (trigger: ${options.trigger})`
        : agent === 'network_rebalance'
          ? `Network rebalance into warehouse ${options.warehouseId}: pull surplus from sister warehouses (autonomy: ${autonomy}, trigger: ${options.trigger})`
        : agent === 'rebalance'
          ? `Rebalance warehouse ${options.warehouseId}: feed starved downstream locations from surplus (autonomy: ${autonomy}, trigger: ${options.trigger})`
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
        : agent === 'po_followup'
          ? this.executePoFollowup(runId, options.userId, options.warehouseId)
        : agent === 'forecast'
          ? this.executeForecast(runId, options.userId, options.warehouseId)
        : agent === 'network_rebalance'
          ? this.executeNetworkRebalance(runId, options.userId, options.displayName, {
              warehouseId: options.warehouseId,
              threshold,
              autonomy,
              budget,
            })
        : agent === 'rebalance'
          ? this.executeRebalance(runId, options.userId, options.displayName, {
              warehouseId: options.warehouseId,
              threshold,
              autonomy,
              budget,
            })
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
    }, null, true)) as { structuredContent?: { records?: Array<Record<string, unknown>> } };
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
      this.mcp.callTool('getPurchaseOrders', { warehouseId: cfg.warehouseId }, null, true),
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

    // Forecast-driven targets (beta, Phase I): when the forecast agent has run
    // for this warehouse, targets come from reorder points (lead-time demand +
    // safety stock) instead of the static 2x-threshold rule.
    let forecastCache: {
      forecasts?: Record<string, { reorderPoint: number; dailyDemand: number }>;
    } | null = null;
    try {
      const raw = await this.redis.raw.get(`forecast:${cfg.warehouseId}`);
      forecastCache = raw ? JSON.parse(raw) : null;
    } catch {
      forecastCache = null;
    }

    const suggestions: Suggestion[] = [];
    const skipped: string[] = [];
    let forecastDriven = 0;
    for (const record of lowRecords) {
      const materialId = String(record.materialId);
      const currentQty = Number(record.quantity || 0);
      const inbound = poRecords
        .filter((po) => po.materialId === materialId && po.status !== 'delivered')
        .reduce((sum, po) => sum + Number(po.qty || 0), 0);
      const forecast = forecastCache?.forecasts?.[materialId];
      const target = forecast ? Math.max(forecast.reorderPoint, cfg.threshold) : cfg.threshold * 2;
      if (forecast) {
        forecastDriven += 1;
      }
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
        // State what the quantities are actually based on. A target of
        // threshold*2 is a placeholder, not a calculation, and 30 such lines
        // read as a costed plan to whoever approves them. Live plants have no
        // demand history (no posting date in the SAP movement feed), so this is
        // the normal case there, not an edge case.
        (forecastDriven > 0 ? ` [forecast-driven targets for ${forecastDriven} material(s)]` : '') +
        (suggestions.length > forecastDriven
          ? ` [${suggestions.length - forecastDriven} quantity(ies) are a top-up to ${cfg.threshold * 2} ` +
            `(2x threshold), NOT demand-based — no consumption history is available for this plant]`
          : '') +
        (skipped.length ? `. Skipped: ${skipped.join('; ')}` : ''),
      'ok',
    );

    if (suggestions.length === 0) {
      await this.finishRun(runId, 'completed', 'Low stock is fully covered by inbound orders and existing drafts.');
      return;
    }

    const totalQty = suggestions.reduce((sum, s) => sum + s.suggestedOrderQty, 0);

    // 2b. CRITIC (beta) — a second model pass reviews the plan before any action.
    const critic = await this.criticReview(userId, cfg.warehouseId, suggestions, poRecords, prRecords);
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

    const withinWindow = await this.withinChangeWindow(cfg.warehouseId);
    if (!withinWindow) {
      await this.addStep(runId, 'info', 'Outside the warehouse change window — auto-act disabled, routing to approval.', 'ok');
    }

    if (cfg.autonomy === 'act' && totalQty <= cfg.budget && critic.available && !critic.flagged && withinWindow) {
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
        `${await this.orgScopePrefix(userId)}wh:${cfg.warehouseId}`,
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
        ? !critic.available
          ? ' Critic could not run, so the plan was not auto-executed — escalated to human approval.'
          : critic.flagged
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
    {
      const { link, blocks } = this.approvalBlocks(action.humanSummary, action.actionId, userId);
      await this.notifyOwner(
        userId,
        'Replenishment plan awaiting approval',
        `WH ${cfg.warehouseId}: ${action.humanSummary}\nOne-click approve (beta): ${link}`,
        blocks,
      );
    }
  }

  /**
   * NETWORK REBALANCER (beta, Phase R): pulls surplus stock of the SAME
   * product from sister warehouses into the goal warehouse when it is
   * starved. Transfers are writes and run through the standard approval /
   * budget / change-window machinery.
   */
  private async executeNetworkRebalance(
    runId: string,
    userId: string,
    displayName: string,
    cfg: { warehouseId: string; threshold: number; autonomy: string; budget: number },
  ) {
    const NETWORK = ['1010', '1020', '1030', '1040', '1050'];
    const stockByWh = new Map<string, Array<Record<string, unknown>>>();
    for (const wh of NETWORK) {
      const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId: wh }, null, true)) as {
        structuredContent?: { records?: Array<Record<string, unknown>> };
      };
      stockByWh.set(wh, (stock.structuredContent?.records ?? []) as Array<Record<string, unknown>>);
    }
    const totalsFor = (wh: string) => {
      const byProduct = new Map<string, number>();
      for (const r of stockByWh.get(wh) ?? []) {
        const pid = String(r.productId || r.materialId);
        byProduct.set(pid, (byProduct.get(pid) ?? 0) + Number(r.quantity || 0));
      }
      return byProduct;
    };

    const local = totalsFor(cfg.warehouseId);
    await this.addStep(
      runId,
      'observe',
      `Observed ${local.size} product(s) locally and stock across ${NETWORK.length - 1} sister warehouse(s).`,
      'ok',
    );

    const transfers: Array<{ productId: string; fromWarehouseId: string; qty: number; donorQty: number }> = [];
    for (const [productId, qty] of local) {
      if (qty >= cfg.threshold) {
        continue;
      }
      let donor: { wh: string; surplus: number; total: number } | null = null;
      for (const wh of NETWORK) {
        if (wh === cfg.warehouseId) {
          continue;
        }
        const donorQty = totalsFor(wh).get(productId) ?? 0;
        const surplus = donorQty - cfg.threshold * 2;
        if (surplus > 0 && (!donor || surplus > donor.surplus)) {
          donor = { wh, surplus, total: donorQty };
        }
      }
      if (donor) {
        const deficit = cfg.threshold * 2 - qty;
        const transferQty = Math.max(Math.min(deficit, donor.surplus), 0);
        if (transferQty > 0) {
          transfers.push({ productId, fromWarehouseId: donor.wh, qty: transferQty, donorQty: donor.total });
        }
      }
    }

    await this.addStep(
      runId,
      'plan',
      `Network plan: ${transfers.length} transfer(s) — ` +
        (transfers.map((t) => `${t.qty} × ${t.productId} from WH ${t.fromWarehouseId} (holds ${t.donorQty})`).join('; ') ||
          'no sister warehouse holds usable surplus'),
      'ok',
    );

    if (transfers.length === 0) {
      await this.finishRun(runId, 'completed', 'No starved product has surplus elsewhere in the network.');
      return;
    }

    const totalQty = transfers.reduce((sum, t) => sum + t.qty, 0);
    if (cfg.autonomy === 'observe') {
      await this.finishRun(runId, 'completed', `Observed: would transfer ${totalQty} unit(s) across ${transfers.length} lane(s).`);
      return;
    }

    const withinWindow = await this.withinChangeWindow(cfg.warehouseId);
    if (cfg.autonomy === 'act' && totalQty <= cfg.budget && withinWindow) {
      for (const t of transfers) {
        await this.mcp.callTool('transferStock', {
          productId: t.productId,
          fromWarehouseId: t.fromWarehouseId,
          toWarehouseId: cfg.warehouseId,
          qty: t.qty,
        });
        await this.invalidateWarehouse(t.fromWarehouseId);
        await this.invalidateWarehouse(cfg.warehouseId);
        await this.addStep(runId, 'act', `Transferred ${t.qty} × ${t.productId} WH ${t.fromWarehouseId} → WH ${cfg.warehouseId}`, 'ok');
      }
      await this.finishRun(runId, 'completed', `Auto-transferred ${totalQty} unit(s) from sister warehouses.`);
      await this.recordEpisode(
        `${await this.orgScopePrefix(userId)}wh:${cfg.warehouseId}`,
        `Network rebalance pulled ${totalQty} unit(s) from sister warehouses.`,
      );
      await this.notifyOwner(userId, 'Network rebalance completed', `WH ${cfg.warehouseId}: pulled ${totalQty} unit(s) from the network.`);
      return;
    }

    const policy = await this.makerCheckerFor(userId, cfg.warehouseId);
    const action: PendingAction = {
      actionId: randomUUID(),
      tool: 'batch',
      params: {
        steps: transfers.map((t) => ({
          tool: 'transferStock',
          params: { productId: t.productId, fromWarehouseId: t.fromWarehouseId, toWarehouseId: cfg.warehouseId, qty: t.qty },
        })),
      },
      humanSummary: `Network rebalance into WH ${cfg.warehouseId}: ${transfers
        .map((t) => `${t.qty} × ${t.productId} from WH ${t.fromWarehouseId}`)
        .join(', ')}`,
      requestedBy: `Network Rebalancer (for ${displayName})`,
      requestedById: userId,
      runId,
      makerChecker: policy,
      ...(!withinWindow ? { anomaly: { reason: 'Outside the warehouse change window' } } : {}),
    };
    await this.redis.raw.setEx(`pending:action:${action.actionId}`, 1200, JSON.stringify({ userId, action }));
    this.realtime.emitPendingAction(userId, action);
    await this.addStep(runId, 'approval', `Awaiting approval of ${transfers.length} network transfer(s).`, 'pending');
    await this.setRunStatus(runId, 'waiting_approval');
    {
      const { link, blocks } = this.approvalBlocks(action.humanSummary, action.actionId, userId);
      await this.notifyOwner(
        userId,
        'Network rebalance awaiting approval',
        `${action.humanSummary}\nOne-click approve (beta): ${link}`,
        blocks,
      );
    }
  }

  /** Invalidate every read-cache entry for a warehouse (used by act-mode transfers). */
  private async invalidateWarehouse(warehouseId: string) {
    const toDelete: string[] = [];
    for await (const key of this.redis.raw.scanIterator({ MATCH: `cache:*:${warehouseId}:*`, COUNT: 200 })) {
      toDelete.push(key);
    }
    if (toDelete.length > 0) {
      await this.redis.raw.del(toDelete);
    }
  }

  /**
   * REBALANCER (beta): within one warehouse, feed starved downstream locations
   * (packing/shipping below threshold) from upstream surplus (bulk/receiving/
   * inspection above 2× threshold). Proposes moveStock through the same
   * approval/anomaly/budget machinery as every other write.
   */
  private async executeRebalance(
    runId: string,
    userId: string,
    displayName: string,
    cfg: { warehouseId: string; threshold: number; autonomy: string; budget: number },
  ) {
    const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId: cfg.warehouseId }, null, true)) as {
      structuredContent?: { records?: Array<Record<string, unknown>> };
    };
    const records = (stock.structuredContent?.records ?? []) as Array<Record<string, unknown>>;
    await this.addStep(runId, 'observe', `Observed ${records.length} stock position(s) in WH ${cfg.warehouseId}.`, 'ok');

    // Group locations by product: a starved location of a product is fed from
    // the same product's most abundant other location (products are not
    // substitutable, so rebalancing is always within one product).
    const byProduct = new Map<string, Array<{ location: string; qty: number }>>();
    for (const r of records) {
      const productId = String(r.productId || r.materialId);
      const list = byProduct.get(productId) ?? [];
      list.push({ location: String(r.location).toLowerCase(), qty: Number(r.quantity || 0) });
      byProduct.set(productId, list);
    }

    const moves: Array<{ productId: string; fromLocation: string; toLocation: string; qty: number }> = [];
    for (const [productId, locs] of byProduct) {
      const starved = locs.find((l) => l.qty < cfg.threshold);
      const surplus = locs
        .filter((l) => l !== starved && l.qty > cfg.threshold * 2)
        .sort((a, b) => b.qty - a.qty)[0];
      if (starved && surplus) {
        const deficit = cfg.threshold * 2 - starved.qty;
        const available = surplus.qty - cfg.threshold * 2;
        const qty = Math.max(Math.min(deficit, available), 0);
        if (qty > 0) {
          moves.push({ productId, fromLocation: surplus.location, toLocation: starved.location, qty });
        }
      }
    }

    await this.addStep(
      runId,
      'plan',
      `Rebalance plan: ${moves.length} move(s) — ` +
        (moves.map((m) => `${m.qty} ${m.productId} ${m.fromLocation}→${m.toLocation}`).join(', ') || 'nothing to rebalance'),
      'ok',
    );

    if (moves.length === 0) {
      await this.finishRun(runId, 'completed', 'Downstream locations are adequately stocked — no rebalancing needed.');
      return;
    }

    const totalQty = moves.reduce((sum, m) => sum + m.qty, 0);

    if (cfg.autonomy === 'observe') {
      await this.finishRun(runId, 'completed', `Observed: would rebalance ${totalQty} units across ${moves.length} move(s).`);
      return;
    }

    const withinWindow = await this.withinChangeWindow(cfg.warehouseId);
    if (cfg.autonomy === 'act' && totalQty <= cfg.budget && withinWindow) {
      for (const m of moves) {
        await this.executeWriteToolExternal('moveStock', { ...m, warehouseId: cfg.warehouseId });
        await this.addStep(runId, 'act', `Moved ${m.qty} × ${m.productId} ${m.fromLocation}→${m.toLocation}`, 'ok');
      }
      await this.finishRun(runId, 'completed', `Auto-rebalanced ${moves.length} move(s), ${totalQty} units.`);
      await this.recordEpisode(`${await this.orgScopePrefix(userId)}wh:${cfg.warehouseId}`, `Auto-rebalanced ${moves.length} move(s) (${totalQty} units).`);
      await this.notifyOwner(userId, 'Rebalance run completed', `WH ${cfg.warehouseId}: auto-rebalanced ${totalQty} units.`);
      return;
    }

    const policy = await this.makerCheckerFor(userId, cfg.warehouseId);
    const escalation = !withinWindow ? ' Outside the warehouse change window — escalated to human approval.' : '';
    const action: PendingAction = {
      actionId: randomUUID(),
      tool: 'batch',
      params: {
        steps: moves.map((m) => ({ tool: 'moveStock', params: { ...m, warehouseId: cfg.warehouseId } })),
      },
      humanSummary: `Rebalance WH ${cfg.warehouseId}: ${moves
        .map((m) => `${m.qty} ${m.productId} ${m.fromLocation}→${m.toLocation}`)
        .join(', ')}`,
      requestedBy: `Rebalancer Agent (for ${displayName})`,
      requestedById: userId,
      runId,
      makerChecker: policy,
    };
    await this.redis.raw.setEx(`pending:action:${action.actionId}`, 1200, JSON.stringify({ userId, action }));
    this.realtime.emitPendingAction(userId, action);
    await this.addStep(runId, 'approval', `Awaiting approval of ${moves.length} rebalance move(s).${escalation}`, 'pending');
    await this.setRunStatus(runId, 'waiting_approval');
    {
      const { link, blocks } = this.approvalBlocks(action.humanSummary, action.actionId, userId);
      await this.notifyOwner(
        userId,
        'Rebalance plan awaiting approval',
        `WH ${cfg.warehouseId}: ${action.humanSummary}\nOne-click approve (beta): ${link}`,
        blocks,
      );
    }
  }

  /** Change window check (Phase D): is the current hour inside the warehouse's write window? */
  private async withinChangeWindow(warehouseId: string): Promise<boolean> {
    const row = await this.db.query<{ s: number | null; e: number | null }>(
      'SELECT write_window_start AS s, write_window_end AS e FROM warehouse_policies WHERE warehouse_id = $1',
      [warehouseId],
    );
    const start = row.rows[0]?.s;
    const end = row.rows[0]?.e;
    if (start === null || start === undefined || end === null || end === undefined) {
      return true; // no window configured → always allowed
    }
    const hour = new Date().getHours();
    return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
  }

  private async makerCheckerFor(userId: string, warehouseId: string): Promise<boolean> {
    const row = await this.db.query<{ mc: boolean }>(
      `SELECT (
         COALESCE((SELECT maker_checker FROM approval_policies WHERE user_id = $1), false)
         OR COALESCE((SELECT bool_or(maker_checker) FROM warehouse_policies WHERE warehouse_id = $2), false)
       ) AS mc`,
      [userId, warehouseId],
    );
    return Boolean(row.rows[0]?.mc);
  }

  /** Executes a stock-mutating tool and maintains the movements cache (used by act-mode agents). */
  private async executeWriteToolExternal(tool: string, params: Record<string, unknown>) {
    const result = await this.mcp.callTool(tool, params);
    const warehouse = String(params.warehouseId || 'global');
    const toDelete: string[] = [];
    for await (const key of this.redis.raw.scanIterator({ MATCH: `cache:*:${warehouse}:*`, COUNT: 200 })) {
      toDelete.push(key);
    }
    if (toDelete.length > 0) {
      await this.redis.raw.del(toDelete);
    }
    const structured = (result?.structuredContent || result) as { movement?: unknown };
    if (structured.movement) {
      await this.redis.raw.zAdd(`cache:movements:${warehouse}`, { score: Date.now(), value: JSON.stringify(structured) });
    }
    return result;
  }

  /**
   * FORECAST AGENT (beta, Phase I): Holt-smoothed per-material demand forecast
   * from 14 days of live movement history, plus safety stock and reorder
   * points at ~95% service level. Results are cached per warehouse and picked
   * up by the replenishment agent, whose targets become forecast-driven.
   */
  private async executeForecast(runId: string, userId: string, warehouseId: string) {
    const [trend, suppliers] = await Promise.all([
      this.mcp.callTool('getDemandTrend', { warehouseId, days: 14, byProduct: true }),
      this.mcp.callTool('getSuppliers', {}),
    ]);
    const trendRecords = ((trend.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const supplierRecords = ((suppliers.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const leadTimes = supplierRecords.map((s) => Number(s.leadTimeDays || 0)).filter((v) => v > 0);
    const leadTimeDays = leadTimes.length ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 10;

    await this.addStep(
      runId,
      'observe',
      `Observed ${trendRecords.length} daily demand point(s) over 14 days; supplier avg lead time ${leadTimeDays}d.`,
      'ok',
    );

    // Bucket per material.
    const byMaterial = new Map<string, Array<{ date: string; qty: number }>>();
    for (const r of trendRecords) {
      const mat = String(r.materialId || r.productId || '');
      if (!mat) {
        continue;
      }
      const list = byMaterial.get(mat) ?? [];
      list.push({ date: String(r.day), qty: Number(r.totalQty || 0) });
      byMaterial.set(mat, list);
    }

    if (byMaterial.size === 0) {
      await this.finishRun(runId, 'completed', 'No demand history in the last 14 days — nothing to forecast.');
      return;
    }

    const forecasts: Record<
      string,
      { dailyDemand: number; trendPerDay: number; horizonDemand: number; safetyStock: number; reorderPoint: number; mapePct: number | null }
    > = {};
    for (const [materialId, records] of byMaterial) {
      const series = toDailySeries(records, 14);
      const f = holtForecast(series, 14);
      const rp = reorderPoint(f, leadTimeDays);
      forecasts[materialId] = {
        dailyDemand: f.dailyDemand,
        trendPerDay: f.trendPerDay,
        horizonDemand: f.horizonDemand,
        safetyStock: rp.safetyStock,
        reorderPoint: rp.reorderPoint,
        mapePct: f.mapePct,
      };
    }

    const summaryLines = Object.entries(forecasts)
      .sort((a, b) => b[1].dailyDemand - a[1].dailyDemand)
      .map(
        ([mat, f]) =>
          `${mat}: ~${f.dailyDemand}/day${f.trendPerDay > 0.5 ? ' ↑' : f.trendPerDay < -0.5 ? ' ↓' : ''}, reorder at ${f.reorderPoint} (safety ${f.safetyStock}${f.mapePct !== null ? `, MAPE ${f.mapePct}%` : ''})`,
      );
    await this.addStep(runId, 'plan', `Forecasts for ${byMaterial.size} material(s): ${summaryLines.join('; ').slice(0, 700)}`, 'ok');

    // 7-day cache; the replenishment agent reads this to set forecast-driven targets.
    await this.redis.raw.setEx(
      `forecast:${warehouseId}`,
      7 * 86400,
      JSON.stringify({ leadTimeDays, generatedAt: new Date().toISOString(), forecasts }),
    );
    await this.addStep(runId, 'act', `Reorder points cached for the replenishment agent (7-day validity).`, 'ok');
    await this.finishRun(runId, 'completed', `Forecasted ${byMaterial.size} material(s); replenishment targets are now forecast-driven.`);
    await this.notifyOwner(
      userId,
      `Demand forecast — WH ${warehouseId}`,
      summaryLines.slice(0, 6).join('\n'),
    );
    await this.recordEpisode(
      `${await this.orgScopePrefix(userId)}wh:${warehouseId}`,
      `Demand forecast: ${summaryLines.slice(0, 3).join('; ')}.`,
    );
  }

  /**
   * PO FOLLOW-UP AGENT (beta, Phase G): finds purchase orders past their
   * expected delivery date and drafts supplier chase messages. Read-only —
   * output is a notification/webhook, never a write.
   */
  private async executePoFollowup(runId: string, userId: string, warehouseId: string) {
    const [pos, sup] = await Promise.all([
      this.mcp.callTool('getPurchaseOrders', { warehouseId }, null, true),
      this.mcp.callTool('getSuppliers', {}),
    ]);
    const supplierByName = new Map(
      (((sup.structuredContent as { records?: Array<Record<string, unknown>> })?.records ?? []) as Array<
        Record<string, unknown>
      >).map((s) => [String(s.name), s]),
    );
    const records = ((pos.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    await this.addStep(runId, 'observe', `Observed ${records.length} purchase order(s) for WH ${warehouseId}.`, 'ok');

    const today = new Date().toISOString().slice(0, 10);
    const overdue = records.filter(
      (po) => po.status !== 'delivered' && typeof po.expectedDelivery === 'string' && String(po.expectedDelivery) < today,
    );
    await this.addStep(
      runId,
      'plan',
      overdue.length
        ? `${overdue.length} overdue PO(s): ${overdue
            .map((po) => `${po.poNumber} (${po.supplier}, due ${po.expectedDelivery}, ${po.qty} × ${po.materialId})`)
            .join('; ')}`
        : 'No overdue purchase orders.',
      'ok',
    );

    if (overdue.length === 0) {
      await this.finishRun(runId, 'completed', 'All open POs are within their expected delivery dates.');
      return;
    }

    const chase = overdue
      .map((po) => {
        const s = supplierByName.get(String(po.supplier));
        const contact = s?.contact ? ` (${s.contact}` + (s.onTimeRatePct !== undefined ? `, ${s.onTimeRatePct}% on-time` : '') + ')' : '';
        return `• ${po.supplier}${contact}: PO ${po.poNumber} (${po.qty} × ${po.materialId}) was due ${po.expectedDelivery} — please confirm a revised delivery date.`;
      })
      .join('\n');
    await this.notifyOwner(userId, `Overdue POs — WH ${warehouseId}`, `Draft supplier chase:\n${chase}`);
    await this.addStep(runId, 'act', `Chase draft for ${overdue.length} supplier message(s) delivered to notifications + webhook.`, 'ok');
    await this.finishRun(runId, 'completed', `Flagged ${overdue.length} overdue PO(s) and drafted supplier chases.`);
    await this.recordEpisode(
      `${await this.orgScopePrefix(userId)}wh:${warehouseId}`,
      `PO follow-up flagged ${overdue.length} overdue order(s): ${overdue.map((p) => p.poNumber).join(', ')}.`,
    );
  }

  /**
   * WHAT-IF SCENARIO (beta, Phase G): extends the dry-run with demand shocks.
   * Daily demand is derived from the live movement trend; the scenario scales
   * it and projects each low position over the horizon. Zero writes.
   */
  async simulateScenario(
    userId: string,
    warehouseId: string,
    threshold: number,
    demandMultiplier: number,
    horizonDays: number,
  ) {
    const base = await this.simulate(userId, warehouseId, threshold);
    const trend = (await this.mcp.callTool('getDemandTrend', { warehouseId, days: 14, byProduct: true })) as {
      structuredContent?: { records?: Array<Record<string, unknown>> };
    };
    const trendRecords = (trend.structuredContent?.records ?? []) as Array<Record<string, unknown>>;
    // Average daily outbound per material over the observed window.
    const dailyByMaterial = new Map<string, number>();
    for (const r of trendRecords) {
      const mat = String(r.materialId ?? r.productId ?? '');
      const qty = Number(r.totalQty ?? r.outboundQty ?? r.qty ?? 0);
      dailyByMaterial.set(mat, (dailyByMaterial.get(mat) ?? 0) + qty);
    }
    for (const [mat, total] of dailyByMaterial) {
      dailyByMaterial.set(mat, total / 14);
    }

    const projected = base.projected.map((p) => {
      const daily = (dailyByMaterial.get(p.materialId) ?? 0) * demandMultiplier;
      const demandOverHorizon = Math.round(daily * horizonDays);
      const endQty = p.currentQty + p.inboundQty - demandOverHorizon;
      return {
        ...p,
        forecastDailyDemand: Math.round(daily * 100) / 100,
        demandOverHorizon,
        projectedEndQty: endQty,
        stockoutRisk: endQty < 0 ? 'STOCKOUT' : endQty < threshold ? 'below threshold' : 'ok',
        suggestedOrderQty: Math.max(threshold * 2 - endQty, 0),
      };
    });

    return {
      ...base,
      scenario: { demandMultiplier, horizonDays },
      projected,
      stockouts: projected.filter((p) => p.projectedEndQty < 0).length,
      totalUnitsToOrder: projected.reduce((s, p) => s + p.suggestedOrderQty, 0),
    };
  }

  /**
   * OBSERVABILITY (beta, Phase F): dependency health + platform metrics in one
   * payload — the pilot-operations dashboard backend.
   */
  async observability(userId: string) {
    const t0 = Date.now();
    await this.db.query('SELECT 1');
    const dbMs = Date.now() - t0;
    const t1 = Date.now();
    await this.redis.raw.ping();
    const redisMs = Date.now() - t1;
    let iflow: { ok: boolean; ms: number } = { ok: false, ms: -1 };
    try {
      const t2 = Date.now();
      const res = await fetch(`${process.env.IFLOW_HEALTH_URL || 'http://iflow-simulator:4000/health'}`);
      iflow = { ok: res.ok, ms: Date.now() - t2 };
    } catch {
      iflow = { ok: false, ms: -1 };
    }

    const orgScope = '(SELECT org_id FROM users WHERE id = $1)';
    const runStats = await this.db.query<{ avg_ms: string | null; p95_ms: string | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::int AS avg_ms,
              PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::int AS p95_ms
       FROM agent_runs r JOIN users u ON u.id = r.user_id
       WHERE r.finished_at IS NOT NULL AND r.finished_at >= r.started_at AND u.org_id = ${orgScope}`,
      [userId],
    );
    const cacheStats = await this.db.query<{ hits: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE cache_status = 'hit')::int AS hits, COUNT(*)::int AS total
       FROM session_logs s JOIN users u ON u.id = s.user_id WHERE u.org_id = ${orgScope}`,
      [userId],
    );
    const modelStats = await this.db.query(
      `SELECT model_used, COUNT(*)::int AS calls, SUM(total_tokens)::int AS tokens
       FROM token_usage t JOIN users u ON u.id = t.user_id WHERE u.org_id = ${orgScope}
       GROUP BY model_used ORDER BY calls DESC LIMIT 8`,
      [userId],
    );
    const total = Number(cacheStats.rows[0]?.total || 0);
    // Measured model quality (beta, Phase K): grounded/answered rate per model.
    const models = [] as Array<Record<string, unknown>>;
    for (const m of modelStats.rows as Array<{ model_used: string; calls: number; tokens: number }>) {
      let quality: number | null = null;
      try {
        const q = await this.redis.raw.hGetAll(`model:quality:${m.model_used}`);
        const qTotal = Number(q.total || 0);
        quality = qTotal >= 3 ? Math.round((Number(q.ok || 0) / qTotal) * 100) : null;
      } catch {
        quality = null;
      }
      models.push({ ...m, qualityPct: quality });
    }
    return {
      dependencies: {
        postgres: { ok: true, ms: dbMs },
        redis: { ok: true, ms: redisMs },
        iflow,
      },
      runs: { avgMs: Number(runStats.rows[0]?.avg_ms || 0), p95Ms: Number(runStats.rows[0]?.p95_ms || 0) },
      cacheHitRate: total ? Math.round((Number(cacheStats.rows[0].hits) / total) * 100) : null,
      models,
    };
  }

  /**
   * CRITIC (beta): an LLM reviews the plan against open orders and drafts.
   * Fails open — if the model is unavailable the plan proceeds with a note.
   */
  /** BYOM per-purpose (beta, Phase Q): the goal owner's 'critic' model, if any. */
  private async criticProvider(userId: string) {
    const rows = await this.db.query<{ id: string; name: string; base_url: string; model_id: string; api_key_enc: string }>(
      `SELECT id, name, base_url, model_id, api_key_enc FROM user_models
       WHERE user_id = $1 AND active = true AND purpose = 'critic' ORDER BY created_at ASC`,
      [userId],
    );
    const configs = [];
    for (const r of rows.rows) {
      try {
        configs.push({ id: r.id, name: r.name, baseUrl: r.base_url, modelId: r.model_id, apiKey: openSecret(r.api_key_enc) });
      } catch {
        // rotated secret — skip
      }
    }
    return this.llm.getProviderForUser(`critic:${userId}`, configs);
  }

  private async criticReview(
    userId: string,
    warehouseId: string,
    suggestions: Suggestion[],
    pos: Array<Record<string, unknown>>,
    prs: Array<Record<string, unknown>>,
  ): Promise<{ flagged: boolean; reason: string; detail: string; available: boolean }> {
    try {
      const provider = await this.criticProvider(userId);
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
        return { flagged: true, reason, available: true, detail: `Critic review (${result.modelUsed}): FLAGGED — ${reason}` };
      }
      return { flagged: false, reason: '', available: true, detail: `Critic review (${result.modelUsed}): plan approved.` };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unavailable';
      // `available: false` is NOT the same as an approved plan. This used to
      // return flagged:false, so a critic that could not run was recorded as a
      // review that passed — and an autonomy:'act' agent wrote to SAP with no
      // review at all. On the free tier that happens most days.
      return {
        flagged: false,
        available: false,
        reason,
        detail: `Critic could not run (${reason}) — auto-execution withheld, routing to human approval.`,
      };
    }
  }

  /** CYCLE-COUNT PLANNER (beta): proposes a weekly count checklist. */
  private async executeCycleCount(runId: string, userId: string, cfg: { warehouseId: string }) {
    const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId: cfg.warehouseId }, null, true)) as {
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
    await this.recordEpisode(`${await this.orgScopePrefix(userId)}wh:${cfg.warehouseId}`, `Cycle-count plan proposed for ${picks.length} positions.`);
  }

  /** Announce a pending approval on the owner's webhook with a one-click link (beta). */
  /**
   * Slack Block Kit payload for an approval (beta): in a Slack app with
   * interactivity pointed at /api/agents/integrations/slack/actions the
   * Approve button works one-click; plain incoming webhooks ignore blocks
   * and show the text fallback.
   */
  private approvalBlocks(summary: string, actionId: string, userId: string) {
    const link = this.quickApproveLink(actionId, userId);
    const token = link.split('token=')[1] ?? '';
    return {
      link,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Approval requested*\n${summary}` } },
        {
          type: 'actions',
          elements: [
            { type: 'button', style: 'primary', text: { type: 'plain_text', text: '✅ Approve' }, action_id: 'fp_quick_approve', value: token },
            { type: 'button', url: link, text: { type: 'plain_text', text: 'Open approval page' } },
          ],
        },
      ],
    };
  }

  async announceApproval(userId: string, action: PendingAction) {
    const { link, blocks } = this.approvalBlocks(action.humanSummary, action.actionId, userId);
    await this.notifyOwner(
      userId,
      'Approval requested',
      `${action.humanSummary}\nOne-click approve (beta): ${link}`,
      blocks,
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
  /**
   * AUTOPILOT SUPERVISOR (beta, Phase N): a meta-agent that patrols every
   * warehouse for each autopilot-enabled organization and decides which
   * specialist agent to dispatch — the end-to-end agentic loop. Runs every
   * 30 minutes; per-warehouse+agent runs are deduplicated to one per 6 hours.
   */
  @Cron('*/30 * * * *')
  async runAutopilotCron() {
    await this.runAutopilot();
  }

  async runAutopilot() {
    const orgs = await this.db.query<{ id: string; name: string }>(
      'SELECT id, name FROM organizations WHERE autopilot = true',
    );
    for (const org of orgs.rows) {
      const admin = await this.db.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM users WHERE org_id = $1 AND role = 'admin' ORDER BY created_at ASC LIMIT 1`,
        [org.id],
      );
      const owner = admin.rows[0];
      if (!owner) {
        continue;
      }
      const dispatched: string[] = [];
      // One stock snapshot per patrol keeps the network checks cheap.
      const stockByWh = new Map<string, Array<Record<string, unknown>>>();
      for (const wh of ['1010', '1020', '1030', '1040', '1050']) {
        try {
          const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId: wh }, null, true)) as {
            structuredContent?: { records?: Array<Record<string, unknown>> };
          };
          stockByWh.set(wh, (stock.structuredContent?.records ?? []) as Array<Record<string, unknown>>);
        } catch {
          stockByWh.set(wh, []);
        }
      }
      for (const warehouseId of ['1010', '1020', '1030', '1040', '1050']) {
        try {
          // Adaptive cadence (beta, Phase R): quiet warehouses back off up to
          // 24h; any dispatch resets the patrol interval to 30 minutes.
          const nextKey = `autopilot:next:${org.id}:${warehouseId}`;
          const nextAt = Number((await this.redis.raw.get(nextKey)) || 0);
          if (nextAt > Date.now()) {
            continue;
          }
          const actions = await this.autopilotAssess(owner.id, warehouseId, stockByWh);
          const backoffKey = `autopilot:backoff:${org.id}:${warehouseId}`;
          if (actions.length > 0) {
            await this.redis.raw.setEx(nextKey, 86400, String(Date.now() + 30 * 60_000));
            await this.redis.raw.setEx(backoffKey, 172800, '30');
          } else {
            const prev = Number((await this.redis.raw.get(backoffKey)) || 30);
            const backoff = Math.min(prev * 2, 1440);
            await this.redis.raw.setEx(nextKey, 172800, String(Date.now() + backoff * 60_000));
            await this.redis.raw.setEx(backoffKey, 172800, String(backoff));
          }
          for (const agent of actions) {
            if (await this.ranRecently(agent, warehouseId, 6)) {
              continue;
            }
            const goal = await this.ensureGoal(owner.id, agent, warehouseId);
            await this.startRun({
              userId: owner.id,
              displayName: `Autopilot (${owner.display_name})`,
              warehouseId,
              goal,
              trigger: 'autopilot',
            });
            dispatched.push(`${agent} → WH ${warehouseId}`);
          }
        } catch (error) {
          this.logger.warn(`Autopilot assess failed for WH ${warehouseId}: ${error instanceof Error ? error.message : 'unknown'}`);
        }
      }
      if (dispatched.length > 0) {
        await this.notifyOwner(owner.id, 'Autopilot dispatch', `Dispatched ${dispatched.length} run(s): ${dispatched.join(', ')}`);
      }
    }
    return { success: true };
  }

  /** Decides which agents a warehouse needs right now. */
  private async autopilotAssess(
    userId: string,
    warehouseId: string,
    stockByWh?: Map<string, Array<Record<string, unknown>>>,
  ): Promise<string[]> {
    const agents: string[] = [];

    const forecastFresh = await this.redis.raw.get(`forecast:${warehouseId}`);
    if (!forecastFresh) {
      agents.push('forecast');
    }

    const low = (await this.mcp.callTool('getLowStock', { warehouseId, threshold: 50 }, null, true)) as {
      structuredContent?: { records?: Array<Record<string, unknown>> };
    };
    if ((low.structuredContent?.records ?? []).length > 0) {
      agents.push('replenishment');
    }

    const pos = (await this.mcp.callTool('getPurchaseOrders', { warehouseId }, null, true)) as {
      structuredContent?: { records?: Array<Record<string, unknown>> };
    };
    const today = new Date().toISOString().slice(0, 10);
    const overdue = (pos.structuredContent?.records ?? []).some(
      (po) => po.status !== 'delivered' && typeof po.expectedDelivery === 'string' && String(po.expectedDelivery) < today,
    );
    if (overdue) {
      agents.push('po_followup');
    }

    // Rebalance: any product starved in one location with 2x surplus in another.
    let records: Array<Record<string, unknown>>;
    if (stockByWh?.has(warehouseId)) {
      records = stockByWh.get(warehouseId)!;
    } else {
      const stock = (await this.mcp.callTool('listWarehouseStock', { warehouseId }, null, true)) as {
        structuredContent?: { records?: Array<Record<string, unknown>> };
      };
      records = (stock.structuredContent?.records ?? []) as Array<Record<string, unknown>>;
    }
    const byProduct = new Map<string, number[]>();
    for (const r of records) {
      const pid = String(r.productId || r.materialId);
      byProduct.set(pid, [...(byProduct.get(pid) ?? []), Number(r.quantity || 0)]);
    }
    const imbalanced = [...byProduct.values()].some(
      (qtys) => qtys.length > 1 && Math.min(...qtys) < 50 && Math.max(...qtys) > 100,
    );
    if (imbalanced) {
      agents.push('rebalance');
    }

    // Network rebalance (Phase R): a locally starved product with real surplus
    // in a sister warehouse.
    if (stockByWh) {
      const localTotals = new Map<string, number>();
      for (const r of records) {
        const pid = String(r.productId || r.materialId);
        localTotals.set(pid, (localTotals.get(pid) ?? 0) + Number(r.quantity || 0));
      }
      outer: for (const [pid, qty] of localTotals) {
        if (qty >= 50) {
          continue;
        }
        for (const [wh, rows] of stockByWh) {
          if (wh === warehouseId) {
            continue;
          }
          const donorQty = rows
            .filter((r) => String(r.productId || r.materialId) === pid)
            .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
          if (donorQty > 100) {
            agents.push('network_rebalance');
            break outer;
          }
        }
      }
    }

    // Cycle count: none completed in the last 7 days.
    const counted = await this.db.query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM agent_runs
       WHERE agent = 'cycle_count' AND warehouse_id = $1 AND started_at > NOW() - INTERVAL '7 days'`,
      [warehouseId],
    );
    if (Number(counted.rows[0]?.n || 0) === 0) {
      agents.push('cycle_count');
    }

    return agents;
  }

  private async ranRecently(agent: string, warehouseId: string, hours: number): Promise<boolean> {
    const row = await this.db.query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM agent_runs
       WHERE agent = $1 AND warehouse_id = $2 AND started_at > NOW() - ($3 || ' hours')::interval`,
      [agent, warehouseId, String(hours)],
    );
    return Number(row.rows[0]?.n || 0) > 0;
  }

  /** Finds the owner's goal for agent+warehouse, creating an observe/propose one if missing. */
  private async ensureGoal(userId: string, agent: string, warehouseId: string): Promise<AgentGoal> {
    const existing = await this.db.query<AgentGoal>(
      'SELECT * FROM agent_goals WHERE user_id = $1 AND agent = $2 AND warehouse_id = $3 AND active = true LIMIT 1',
      [userId, agent, warehouseId],
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }
    return this.createGoal(userId, { warehouseId, agent, autonomy: 'propose' });
  }

  async checkOutcomes() {
    await this.checkForecastOutcomes();
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
          this.mcp.callTool('getLowStock', { warehouseId: run.warehouse_id, threshold }, null, true),
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
        await this.recordEpisode(`${await this.orgScopePrefix(run.user_id)}wh:${run.warehouse_id}`, `Replenishment run outcome — ${outcome}`);
      } catch (error) {
        this.logger.warn(`Outcome check failed for run ${run.id}: ${error instanceof Error ? error.message : '?'}`);
      }
    }
  }

  /** EPISODIC MEMORY (beta): short keyed summaries of what happened. */
  /** Phase O (beta): score past forecasts against demand that actually happened. */
  private async checkForecastOutcomes() {
    const runs = await this.db.query<{ id: string; user_id: string; warehouse_id: string }>(
      `SELECT id, user_id, warehouse_id FROM agent_runs
       WHERE agent = 'forecast' AND status = 'completed' AND outcome IS NULL
         AND finished_at < NOW() - INTERVAL '30 minutes'
       LIMIT 5`,
    );
    for (const run of runs.rows) {
      try {
        const raw = await this.redis.raw.get(`forecast:${run.warehouse_id}`);
        if (!raw) {
          continue;
        }
        const cache = JSON.parse(raw) as { forecasts: Record<string, { dailyDemand: number }> };
        const trend = (await this.mcp.callTool('getDemandTrend', { warehouseId: run.warehouse_id, days: 7, byProduct: true })) as {
          structuredContent?: { records?: Array<Record<string, unknown>> };
        };
        const actualByMat = new Map<string, number>();
        for (const r of trend.structuredContent?.records ?? []) {
          const mat = String(r.materialId || r.productId || '');
          actualByMat.set(mat, (actualByMat.get(mat) ?? 0) + Number(r.totalQty || 0));
        }
        const errors: number[] = [];
        for (const [mat, f] of Object.entries(cache.forecasts)) {
          const actualDaily = (actualByMat.get(mat) ?? 0) / 7;
          if (actualDaily > 0) {
            errors.push(Math.abs(f.dailyDemand - actualDaily) / actualDaily);
          }
        }
        if (errors.length === 0) {
          continue;
        }
        const mape = Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 100);
        const outcome =
          mape <= 30
            ? `Effective: forecast within ${mape}% of actual demand across ${errors.length} material(s).`
            : `Partially effective: forecast off by ${mape}% vs actual demand (${errors.length} material(s)).`;
        await this.db.query('UPDATE agent_runs SET outcome = $1, outcome_checked_at = NOW() WHERE id = $2', [outcome, run.id]);
        await this.addStep(run.id, 'outcome', outcome, 'ok');
      } catch (error) {
        this.logger.warn(`Forecast outcome check failed: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
  }

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

  /**
   * DRY-RUN SIMULATION (Phase D safety rail): observe + plan + project the
   * post-state, with ZERO writes and no approval. Answers "what would it do?"
   */
  async simulate(userId: string, warehouseId: string, threshold: number) {
    const [low, pos, prs] = await Promise.all([
      this.mcp.callTool('getLowStock', { warehouseId, threshold }, null, true),
      this.mcp.callTool('getPurchaseOrders', { warehouseId }, null, true),
      this.mcp.callTool('getPurchaseRequisitions', { warehouseId }),
    ]);
    const lowRecords = ((low.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const poRecords = ((pos.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const prRecords = ((prs.structuredContent as { records?: Array<Record<string, unknown>> })?.records ??
      []) as Array<Record<string, unknown>>;
    const recentDrafts = new Set(prRecords.map((r) => String(r.materialId)));

    const projected = lowRecords.map((r) => {
      const materialId = String(r.materialId);
      const currentQty = Number(r.quantity || 0);
      const inbound = poRecords
        .filter((po) => po.materialId === materialId && po.status !== 'delivered')
        .reduce((sum, po) => sum + Number(po.qty || 0), 0);
      const target = threshold * 2;
      const suggestedOrderQty = recentDrafts.has(materialId) ? 0 : Math.max(target - currentQty - inbound, 0);
      return {
        materialId,
        currentQty,
        inboundQty: inbound,
        suggestedOrderQty,
        projectedQty: currentQty + inbound + suggestedOrderQty,
        note: recentDrafts.has(materialId) ? 'skipped: draft already exists' : suggestedOrderQty === 0 ? 'covered by inbound' : 'would draft',
      };
    });

    return {
      warehouseId,
      threshold,
      dryRun: true,
      lowPositions: lowRecords.length,
      totalUnitsToOrder: projected.reduce((sum, p) => sum + p.suggestedOrderQty, 0),
      projected,
    };
  }

  /** RUN ANALYTICS (Phase D observability): effectiveness, cost, throughput. */
  async metrics(userId: string, isAdmin: boolean) {
    const scope = isAdmin
      ? 'WHERE user_id IN (SELECT id FROM users WHERE org_id = (SELECT org_id FROM users WHERE id = $1))'
      : 'WHERE user_id = $1';
    const params = [userId];
    const runs = await this.db.query<{
      total: string;
      completed: string;
      failed: string;
      waiting: string;
      effective: string;
      checked: string;
    }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE status = 'waiting_approval')::int AS waiting,
         COUNT(*) FILTER (WHERE outcome LIKE 'Effective%')::int AS effective,
         COUNT(*) FILTER (WHERE outcome IS NOT NULL)::int AS checked
       FROM agent_runs ${scope}`,
      params,
    );
    const fb = await this.db.query<{ up: string; down: string }>(
      `SELECT COUNT(*) FILTER (WHERE rating = 1)::int AS up, COUNT(*) FILTER (WHERE rating = -1)::int AS down
       FROM feedback ${scope}`,
      params,
    );
    const r = runs.rows[0];
    const f = fb.rows[0];
    const checked = Number(r.checked);
    return {
      totalRuns: Number(r.total),
      completed: Number(r.completed),
      failed: Number(r.failed),
      waitingApproval: Number(r.waiting),
      effectivenessPct: checked ? Math.round((Number(r.effective) / checked) * 100) : null,
      feedback: { up: Number(f.up), down: Number(f.down) },
    };
  }

  /** Low-rated chat turns become candidate eval cases (feedback flywheel). */
  async feedbackReview(userId: string, isAdmin: boolean) {
    const rows = await this.db.query(
      `SELECT f.rating, f.comment, f.created_at, u.email,
              (SELECT content FROM conversation_messages m
               WHERE m.conversation_id = f.conversation_id AND m.role = 'user'
               ORDER BY m.created_at DESC LIMIT 1) AS last_question
       FROM feedback f JOIN users u ON u.id = f.user_id
       WHERE ${isAdmin ? 'u.org_id = (SELECT org_id FROM users WHERE id = $1)' : 'f.user_id = $1'}
       ORDER BY f.created_at DESC LIMIT 50`,
      [userId],
    );
    return rows.rows;
  }

  /** Feedback flywheel (beta): promote a question into the eval regression suite. */
  async promoteEvalCase(userId: string, question: string, expectSubstring?: string) {
    const row = await this.db.query(
      `INSERT INTO eval_cases(org_id, question, expect_substring)
       VALUES((SELECT org_id FROM users WHERE id = $1), $2, $3) RETURNING *`,
      [userId, question, expectSubstring ?? null],
    );
    return row.rows[0];
  }

  async listEvalCases(userId: string) {
    const rows = await this.db.query(
      `SELECT * FROM eval_cases WHERE org_id = (SELECT org_id FROM users WHERE id = $1) ORDER BY created_at DESC`,
      [userId],
    );
    return rows.rows;
  }

  /** Episodic scope prefix — episodes are tenant-scoped so recall never crosses orgs. */
  private orgCache = new Map<string, string>();
  async orgScopePrefix(userId: string): Promise<string> {
    if (!this.orgCache.has(userId)) {
      const row = await this.db.query<{ org_id: string | null }>('SELECT org_id FROM users WHERE id = $1', [userId]);
      this.orgCache.set(userId, row.rows[0]?.org_id ?? 'default');
    }
    return `org:${this.orgCache.get(userId)}:`;
  }

  /** RETENTION (Phase D): daily purge of aged runs, logs, and read notifications. */
  @Cron('30 3 * * *')
  async purgeRetention() {
    const days = Number(process.env.RETENTION_DAYS || 90);
    const runs = await this.db.query(
      `DELETE FROM agent_runs WHERE finished_at IS NOT NULL AND finished_at < NOW() - ($1 || ' days')::interval`,
      [String(days)],
    );
    await this.db.query(
      `DELETE FROM session_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [String(days)],
    );
    await this.db.query(
      `DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < NOW() - ($1 || ' days')::interval`,
      [String(days)],
    );
    this.logger.log(`Retention purge (${days}d): removed ${runs.rowCount ?? 0} aged agent runs and stale logs.`);
  }

  /** Called by the approval flow when a run-linked action was executed. */
  async onActionExecuted(runId: string, approverName: string, warehouseId: string, executedQty: number, count: number) {
    await this.addStep(runId, 'act', `${count} draft(s) executed after approval by ${approverName} (${executedQty} units).`, 'ok');
    await this.verifyDrafts(runId, warehouseId, null);
    await this.finishRun(runId, 'completed', `Completed after human approval by ${approverName}.`);
    const runOwner = await this.db.query<{ user_id: string }>('SELECT user_id FROM agent_runs WHERE id = $1', [runId]);
    await this.recordEpisode(
      `${await this.orgScopePrefix(runOwner.rows[0]?.user_id ?? '')}wh:${warehouseId}`,
      `Replenishment plan (${executedQty} units) approved by ${approverName} and executed.`,
    );
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

  private async notifyOwner(userId: string, title: string, body: string, blocks?: unknown[]) {
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
          body: JSON.stringify({ text: `*${title}*\n${body}`, ...(blocks ? { blocks } : {}) }),
        });
      }
    } catch (error) {
      this.logger.warn(`Webhook delivery failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
