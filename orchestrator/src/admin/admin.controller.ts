import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/roles.guard';
import type { AuthUser } from '../common/types';
import { DbService } from '../common/db.service';
import { throwApiError } from '../common/errors';

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  role: z.enum(['admin', 'viewer']),
  monthly_token_limit: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'viewer']).optional(),
  display_name: z.string().min(1).optional(),
});

const scopesSchema = z.object({
  scopes: z.array(z.object({ warehouse_id: z.string(), access_level: z.enum(['read', 'write']) })),
});

const quotaSchema = z.object({
  monthly_token_limit: z.number().int().positive(),
  daily_token_limit: z.number().int().positive().nullable().optional(),
  weekly_token_limit: z.number().int().positive().nullable().optional(),
  overage_policy: z.enum(['block', 'warn']).optional(),
});

const cachePolicySchema = z.object({
  enabled: z.boolean().optional(),
  ttl_seconds: z.number().int().positive().nullable().optional(),
  key_strategy: z.enum(['global', 'per_user']).optional(),
});

@Controller('/api/admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly db: DbService) {}

  @Get()
  async listUsers(@CurrentUser() admin: AuthUser) {
    const users = await this.db.query(
      `SELECT u.id,
              u.email,
              u.display_name,
              u.role,
              u.created_at,
              COALESCE(q.monthly_token_limit, 50000) AS monthly_token_limit,
              q.daily_token_limit,
              q.weekly_token_limit,
              COALESCE(q.overage_policy, 'block') AS overage_policy,
              p.auto_approve_max_qty,
              COALESCE(p.maker_checker, false) AS maker_checker,
              u.webhook_url,
              (u.password_hash IS NOT NULL) AS has_password,
              COALESCE(s.scopes, '[]'::json) AS scopes
       FROM users u
       LEFT JOIN user_quota q ON q.user_id = u.id
       LEFT JOIN approval_policies p ON p.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                json_agg(json_build_object('warehouse_id', warehouse_id, 'access_level', access_level)) AS scopes
         FROM user_scopes
         GROUP BY user_id
       ) s ON s.user_id = u.id
       WHERE u.org_id = (SELECT org_id FROM users WHERE id = $1)
       ORDER BY u.created_at DESC`,
      [admin.id],
    );
    return users.rows;
  }

  /** Org profile for the admin's tenant (beta multi-tenancy): name + join code to invite teammates. */
  @Get('/org')
  async orgProfile(@CurrentUser() admin: AuthUser) {
    const row = await this.db.query(
      `SELECT o.id, o.name, o.join_code, o.autopilot, o.created_at,
              (SELECT COUNT(*)::int FROM users WHERE org_id = o.id) AS member_count
       FROM organizations o JOIN users u ON u.org_id = o.id WHERE u.id = $1`,
      [admin.id],
    );
    return row.rows[0] ?? null;
  }

  /** Autopilot toggle (beta, Phase N): org-level kill switch for the supervisor. */
  @Patch('/org/autopilot')
  async setAutopilot(@CurrentUser() admin: AuthUser, @Body() body: unknown) {
    const parsed = z.object({ enabled: z.boolean() }).parse(body);
    await this.db.query(
      'UPDATE organizations SET autopilot = $1 WHERE id = (SELECT org_id FROM users WHERE id = $2)',
      [parsed.enabled, admin.id],
    );
    return { autopilot: parsed.enabled };
  }

  /** GDPR-style data deletion (beta): purge a user's conversational and telemetry data, keep the account. */
  @Delete('/:id/data')
  async purgeUserData(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const target = await this.db.query<{ org_id: string | null }>('SELECT org_id FROM users WHERE id = $1', [id]);
    const own = await this.db.query<{ org_id: string | null }>('SELECT org_id FROM users WHERE id = $1', [admin.id]);
    if (!target.rows[0] || target.rows[0].org_id !== own.rows[0]?.org_id) {
      throwApiError(404, 'VALIDATION_ERROR', 'User not found in your organization');
    }
    const tables = [
      'conversations',
      'session_logs',
      'notifications',
      'stock_alerts',
      'scheduled_reports',
      'token_usage',
      'feedback',
    ];
    for (const t of tables) {
      await this.db.query(`DELETE FROM ${t} WHERE user_id = $1`, [id]);
    }
    return { success: true, purged: tables };
  }

  /** Audit export (beta): every agent run in the admin's org as CSV for SIEM ingestion. */
  @Get('/audit/agent-runs.csv')
  async auditRunsCsv(@CurrentUser() admin: AuthUser, @Res() res: Response) {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT r.id, r.agent, r.warehouse_id, r.goal_text, r.status, r.outcome, u.email AS owner,
              r.started_at, r.finished_at, jsonb_array_length(r.steps) AS step_count
       FROM agent_runs r JOIN users u ON u.id = r.user_id
       WHERE u.org_id = (SELECT org_id FROM users WHERE id = $1)
       ORDER BY r.started_at DESC LIMIT 2000`,
      [admin.id],
    );
    const cols = ['id', 'agent', 'warehouse_id', 'goal_text', 'status', 'outcome', 'owner', 'started_at', 'finished_at', 'step_count'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...rows.rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypilot-agent-runs.csv"');
    res.send(csv);
  }

  @Post()
  async createUser(@Body() body: unknown) {
    const parsed = createUserSchema.parse(body);
    const row = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'viewer';
      created_at: string;
    }>(
      `INSERT INTO users(email, display_name, role)
       VALUES($1, $2, $3)
       RETURNING id, email, display_name, role, created_at`,
      [parsed.email, parsed.display_name, parsed.role],
    );

    await this.db.query(
      `INSERT INTO user_quota(user_id, monthly_token_limit, period_start)
       VALUES($1, $2, CURRENT_DATE)
       ON CONFLICT (user_id)
       DO UPDATE SET monthly_token_limit = EXCLUDED.monthly_token_limit`,
      [row.rows[0].id, parsed.monthly_token_limit ?? 50000],
    );

    return row.rows[0];
  }

  @Patch('/:id')
  async updateUser(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateUserSchema.parse(body);
    await this.db.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           role = COALESCE($2, role)
       WHERE id = $3`,
      [parsed.display_name ?? null, parsed.role ?? null, id],
    );

    const row = await this.db.query('SELECT id, email, display_name, role, created_at FROM users WHERE id = $1', [id]);
    return row.rows[0];
  }

  @Patch('/:id/scopes')
  async replaceScopes(@Param('id') id: string, @Body() body: unknown) {
    const parsed = scopesSchema.parse(body);
    await this.db.query('DELETE FROM user_scopes WHERE user_id = $1', [id]);

    for (const scope of parsed.scopes) {
      await this.db.query(
        'INSERT INTO user_scopes(user_id, warehouse_id, access_level) VALUES($1, $2, $3)',
        [id, scope.warehouse_id, scope.access_level],
      );
    }

    const scopes = await this.db.query(
      'SELECT id, user_id, warehouse_id, access_level FROM user_scopes WHERE user_id = $1',
      [id],
    );
    return scopes.rows;
  }

  @Patch('/:id/quota')
  async updateQuota(@Param('id') id: string, @Body() body: unknown) {
    const parsed = quotaSchema.parse(body);
    await this.db.query(
      `INSERT INTO user_quota(user_id, monthly_token_limit, daily_token_limit, weekly_token_limit, overage_policy, period_start)
       VALUES($1, $2, $3, $4, COALESCE($5, 'block'), CURRENT_DATE)
       ON CONFLICT (user_id)
       DO UPDATE SET monthly_token_limit = EXCLUDED.monthly_token_limit,
         daily_token_limit = CASE WHEN $6 THEN $3 ELSE user_quota.daily_token_limit END,
         weekly_token_limit = CASE WHEN $7 THEN $4 ELSE user_quota.weekly_token_limit END,
         overage_policy = COALESCE($5, user_quota.overage_policy)`,
      [
        id,
        parsed.monthly_token_limit,
        parsed.daily_token_limit ?? null,
        parsed.weekly_token_limit ?? null,
        parsed.overage_policy ?? null,
        parsed.daily_token_limit !== undefined,
        parsed.weekly_token_limit !== undefined,
      ],
    );

    const quota = await this.db.query(
      `SELECT user_id, monthly_token_limit, daily_token_limit, weekly_token_limit, overage_policy, period_start
       FROM user_quota WHERE user_id = $1`,
      [id],
    );
    return quota.rows[0];
  }

  /**
   * Per-tool cache policies (spec alignment). The tool list is data-driven:
   * every read tool that ever appeared in session logs, plus explicit rows.
   */
  @Get('/cache-policies/list')
  async listCachePolicies() {
    const rows = await this.db.query(
      `SELECT t.tool_name,
              COALESCE(p.enabled, true) AS enabled,
              p.ttl_seconds,
              COALESCE(p.key_strategy, 'global') AS key_strategy,
              (p.tool_name IS NOT NULL) AS configured
       FROM (
         SELECT DISTINCT jsonb_array_elements_text(tools_invoked_json) AS tool_name FROM session_logs
         UNION
         SELECT tool_name FROM cache_policies
       ) t
       LEFT JOIN cache_policies p ON p.tool_name = t.tool_name
       ORDER BY t.tool_name`,
    );
    return rows.rows;
  }

  @Patch('/cache-policies/:toolName')
  async updateCachePolicy(@Param('toolName') toolName: string, @Body() body: unknown) {
    const parsed = cachePolicySchema.parse(body);
    await this.db.query(
      `INSERT INTO cache_policies(tool_name, enabled, ttl_seconds, key_strategy)
       VALUES($1, COALESCE($2, true), $3, COALESCE($4, 'global'))
       ON CONFLICT (tool_name) DO UPDATE SET
         enabled = COALESCE($2, cache_policies.enabled),
         ttl_seconds = CASE WHEN $5 THEN $3 ELSE cache_policies.ttl_seconds END,
         key_strategy = COALESCE($4, cache_policies.key_strategy),
         updated_at = NOW()`,
      [
        toolName,
        parsed.enabled ?? null,
        parsed.ttl_seconds ?? null,
        parsed.key_strategy ?? null,
        parsed.ttl_seconds !== undefined,
      ],
    );
    const row = await this.db.query('SELECT * FROM cache_policies WHERE tool_name = $1', [toolName]);
    return row.rows[0];
  }

  @Patch('/:id/policy')
  async updatePolicy(@Param('id') id: string, @Body() body: unknown) {
    const parsed = z
      .object({
        auto_approve_max_qty: z.number().int().positive().nullable().optional(),
        maker_checker: z.boolean().optional(),
      })
      .parse(body);

    await this.db.query(
      `INSERT INTO approval_policies(user_id, auto_approve_max_qty, maker_checker)
       VALUES($1, $2, COALESCE($3, false))
       ON CONFLICT (user_id) DO UPDATE SET
         auto_approve_max_qty = CASE WHEN $4 THEN $2 ELSE approval_policies.auto_approve_max_qty END,
         maker_checker = COALESCE($3, approval_policies.maker_checker)`,
      [
        id,
        parsed.auto_approve_max_qty ?? null,
        parsed.maker_checker ?? null,
        parsed.auto_approve_max_qty !== undefined,
      ],
    );

    const row = await this.db.query('SELECT * FROM approval_policies WHERE user_id = $1', [id]);
    return row.rows[0] ?? { user_id: id, auto_approve_max_qty: null, maker_checker: false };
  }

  @Patch('/:id/webhook')
  async updateWebhook(@Param('id') id: string, @Body() body: unknown) {
    const parsed = z.object({ webhook_url: z.string().url().nullable() }).parse(body);
    await this.db.query('UPDATE users SET webhook_url = $1 WHERE id = $2', [parsed.webhook_url, id]);
    return { user_id: id, webhook_url: parsed.webhook_url };
  }

  @Get('/warehouse-policies/list')
  async listWarehousePolicies() {
    const rows = await this.db.query('SELECT * FROM warehouse_policies ORDER BY warehouse_id');
    return rows.rows;
  }

  @Patch('/warehouse-policies/:warehouseId')
  async updateWarehousePolicy(@Param('warehouseId') warehouseId: string, @Body() body: unknown) {
    const parsed = z
      .object({
        auto_approve_max_qty: z.number().int().positive().nullable().optional(),
        maker_checker: z.boolean().optional(),
        write_window_start: z.number().int().min(0).max(23).nullable().optional(),
        write_window_end: z.number().int().min(0).max(24).nullable().optional(),
      })
      .parse(body);

    await this.db.query(
      `INSERT INTO warehouse_policies(warehouse_id, auto_approve_max_qty, maker_checker, write_window_start, write_window_end)
       VALUES($1, $2, COALESCE($3, false), $5, $6)
       ON CONFLICT (warehouse_id) DO UPDATE SET
         auto_approve_max_qty = CASE WHEN $4 THEN $2 ELSE warehouse_policies.auto_approve_max_qty END,
         maker_checker = COALESCE($3, warehouse_policies.maker_checker),
         write_window_start = CASE WHEN $7 THEN $5 ELSE warehouse_policies.write_window_start END,
         write_window_end = CASE WHEN $7 THEN $6 ELSE warehouse_policies.write_window_end END`,
      [
        warehouseId,
        parsed.auto_approve_max_qty ?? null,
        parsed.maker_checker ?? null,
        parsed.auto_approve_max_qty !== undefined,
        parsed.write_window_start ?? null,
        parsed.write_window_end ?? null,
        parsed.write_window_start !== undefined || parsed.write_window_end !== undefined,
      ],
    );
    const row = await this.db.query('SELECT * FROM warehouse_policies WHERE warehouse_id = $1', [warehouseId]);
    return row.rows[0];
  }

  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return { success: true };
  }
}
