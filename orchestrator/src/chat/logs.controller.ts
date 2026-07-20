import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { DbService } from '../common/db.service';

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(','));
  }
  return lines.join('\n');
}

@Controller('/api')
@UseGuards(AuthGuard)
export class LogsController {
  constructor(private readonly db: DbService) {}

  @Get('/session-logs')
  async sessionLogs(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    const targetUser = user.role === 'admin' && userId ? userId : user.id;

    const rows = await this.db.query(
      `SELECT *
       FROM session_logs
       WHERE user_id = $1
         AND created_at >= COALESCE($2::timestamp, created_at)
         AND created_at <= COALESCE($3::timestamp, created_at)
       ORDER BY created_at DESC
       LIMIT 500`,
      [targetUser, from || null, to || null],
    );

    return rows.rows;
  }

  @Get('/token-usage')
  async tokenUsage(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    const params: unknown[] = [];
    let where = 'WHERE 1=1';

    if (user.role !== 'admin') {
      params.push(user.id);
      where += ` AND tu.user_id = $${params.length}`;
    } else if (userId) {
      params.push(userId);
      where += ` AND tu.user_id = $${params.length}`;
    }

    if (from) {
      params.push(from);
      where += ` AND tu.occurred_at >= $${params.length}::timestamp`;
    }

    if (to) {
      params.push(to);
      where += ` AND tu.occurred_at <= $${params.length}::timestamp`;
    }

    const sql = `SELECT tu.user_id,
                        u.email,
                        DATE(tu.occurred_at) AS day,
                        SUM(tu.total_tokens)::int AS total_tokens
                 FROM token_usage tu
                 JOIN users u ON u.id = tu.user_id
                 ${where}
                 GROUP BY tu.user_id, u.email, DATE(tu.occurred_at)
                 ORDER BY day DESC`;

    const rows = await this.db.query(sql, params);
    return rows.rows;
  }

  /**
   * Spec-alignment KPIs (Phase T): throughput, cache ratio, rejections,
   * latency split and top questions over the last N days. Admins see their
   * whole org; everyone else sees their own traffic.
   */
  @Get('/analytics/overview')
  async analyticsOverview(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
    const scope =
      user.role === 'admin'
        ? 'user_id IN (SELECT id FROM users WHERE org_id = (SELECT org_id FROM users WHERE id = $1))'
        : 'user_id = $1';
    const base = `FROM session_logs WHERE ${scope} AND created_at >= NOW() - ($2 || ' days')::interval`;
    const params = [user.id, String(windowDays)];

    const [perDay, byTool, byChannel, totals, topQuestions] = await Promise.all([
      this.db.query(
        `SELECT DATE(created_at) AS day,
                COUNT(*)::int AS requests,
                COUNT(*) FILTER (WHERE status = 'blocked_quota')::int AS rejected,
                COUNT(*) FILTER (WHERE cache_status = 'hit')::int AS cache_hits
         ${base} GROUP BY DATE(created_at) ORDER BY day`,
        params,
      ),
      this.db.query(
        `SELECT tool, COUNT(*)::int AS calls
         FROM (SELECT jsonb_array_elements_text(tools_invoked_json) AS tool ${base}) t
         GROUP BY tool ORDER BY calls DESC LIMIT 12`,
        params,
      ),
      this.db.query(
        `SELECT COALESCE(channel, 'chat') AS channel, COUNT(*)::int AS requests ${base} GROUP BY channel`,
        params,
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS requests,
                COUNT(*) FILTER (WHERE cache_status = 'hit')::int AS cache_hits,
                COUNT(*) FILTER (WHERE cache_status = 'miss')::int AS cache_misses,
                COUNT(*) FILTER (WHERE status = 'blocked_quota')::int AS rejected,
                COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
                ROUND(AVG(latency_ms))::int AS avg_latency_ms,
                ROUND(AVG(latency_ms) FILTER (WHERE cache_status = 'hit'))::int AS avg_cache_hit_ms,
                ROUND(AVG(tool_ms))::int AS avg_tool_ms,
                ROUND(AVG(llm_ms))::int AS avg_llm_ms
         ${base}`,
        params,
      ),
      this.db.query(
        `SELECT LOWER(query_text) AS question, COUNT(*)::int AS times
         ${base} AND query_text NOT LIKE 'confirm-action:%' AND query_text NOT LIKE 'board-%'
         GROUP BY LOWER(query_text) ORDER BY times DESC LIMIT 8`,
        params,
      ),
    ]);

    return {
      windowDays,
      perDay: perDay.rows,
      byTool: byTool.rows,
      byChannel: byChannel.rows,
      totals: totals.rows[0],
      topQuestions: topQuestions.rows,
    };
  }

  @Get('/session-logs/export.csv')
  async sessionLogsCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const rows = await this.db.query(
      `SELECT created_at, query_text, status, tools_invoked_json::text AS tools, cache_status, tokens_used, latency_ms,
              channel, model, tool_ms, llm_ms, payload_bytes, error_detail
       FROM session_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 2000`,
      [user.id],
    );
    const csv = toCsv(rows.rows as Array<Record<string, unknown>>, [
      'created_at',
      'query_text',
      'status',
      'tools',
      'cache_status',
      'tokens_used',
      'latency_ms',
      'channel',
      'model',
      'tool_ms',
      'llm_ms',
      'payload_bytes',
      'error_detail',
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypilot-activity.csv"');
    res.send(csv);
  }

  @Get('/token-usage/export.csv')
  async tokenUsageCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (user.role !== 'admin') {
      params.push(user.id);
      where += ` AND tu.user_id = $${params.length}`;
    }

    const rows = await this.db.query(
      `SELECT DATE(tu.occurred_at) AS day, u.email, SUM(tu.total_tokens)::int AS total_tokens
       FROM token_usage tu
       JOIN users u ON u.id = tu.user_id
       ${where}
       GROUP BY DATE(tu.occurred_at), u.email
       ORDER BY day DESC`,
      params,
    );
    const csv = toCsv(rows.rows as Array<Record<string, unknown>>, ['day', 'email', 'total_tokens']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypilot-token-usage.csv"');
    res.send(csv);
  }
}
