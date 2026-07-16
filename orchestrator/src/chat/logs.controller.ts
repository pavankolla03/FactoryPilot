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

  @Get('/session-logs/export.csv')
  async sessionLogsCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const rows = await this.db.query(
      `SELECT created_at, query_text, status, tools_invoked_json::text AS tools, cache_status, tokens_used, latency_ms
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
