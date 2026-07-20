import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../common/db.service';
import type { QuotaWindow, UsageSnapshot } from '../common/types';

@Injectable()
export class QuotaService {
  constructor(private readonly db: DbService) {}

  async getUsage(userId: string): Promise<UsageSnapshot> {
    const result = await this.db.query<{
      monthly_used: number;
      weekly_used: number;
      daily_used: number;
      monthly_token_limit: number;
      weekly_token_limit: number | null;
      daily_token_limit: number | null;
      overage_policy: string;
      period_start: string;
    }>(
      `SELECT COALESCE(SUM(t.total_tokens) FILTER (WHERE t.occurred_at >= q.period_start), 0)::int AS monthly_used,
              COALESCE(SUM(t.total_tokens) FILTER (WHERE t.occurred_at >= date_trunc('week', NOW())), 0)::int AS weekly_used,
              COALESCE(SUM(t.total_tokens) FILTER (WHERE t.occurred_at >= date_trunc('day', NOW())), 0)::int AS daily_used,
              q.monthly_token_limit,
              q.weekly_token_limit,
              q.daily_token_limit,
              q.overage_policy,
              q.period_start::text
       FROM user_quota q
       LEFT JOIN token_usage t ON t.user_id = q.user_id
       WHERE q.user_id = $1
       GROUP BY q.monthly_token_limit, q.weekly_token_limit, q.daily_token_limit, q.overage_policy, q.period_start`,
      [userId],
    );

    const row = result.rows[0];
    const windows: QuotaWindow[] = [];
    if (row?.daily_token_limit) {
      windows.push({ window: 'daily', used: row.daily_used, limit: row.daily_token_limit });
    }
    if (row?.weekly_token_limit) {
      windows.push({ window: 'weekly', used: row.weekly_used, limit: row.weekly_token_limit });
    }
    windows.push({
      window: 'monthly',
      used: row?.monthly_used ?? 0,
      limit: row?.monthly_token_limit ?? 50000,
    });

    return {
      used: row?.monthly_used ?? 0,
      limit: row?.monthly_token_limit ?? 50000,
      periodStart: row?.period_start || new Date().toISOString().slice(0, 10),
      windows,
      overagePolicy: (row?.overage_policy as 'block' | 'warn') || 'block',
    };
  }

  /**
   * Multi-window check (spec: day/week/month limits). The tightest exceeded
   * window wins. overage_policy 'warn' reports the breach but never blocks.
   */
  async isExceeded(userId: string): Promise<{
    exceeded: boolean;
    warned: boolean;
    window: 'daily' | 'weekly' | 'monthly' | null;
    resetAt: string | null;
    snapshot: UsageSnapshot;
  }> {
    const snapshot = await this.getUsage(userId);
    const breached = (snapshot.windows ?? []).find((w) => w.used >= w.limit) ?? null;
    if (!breached) {
      return { exceeded: false, warned: false, window: null, resetAt: null, snapshot };
    }
    const warn = snapshot.overagePolicy === 'warn';
    return {
      exceeded: !warn,
      warned: warn,
      window: breached.window,
      resetAt: this.windowResetDate(breached.window, snapshot.periodStart),
      snapshot,
    };
  }

  private windowResetDate(window: 'daily' | 'weekly' | 'monthly', periodStart: string): string {
    const now = new Date();
    if (window === 'daily') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (window === 'weekly') {
      const d = new Date(now);
      const day = d.getDay() || 7; // Monday-based week, matching date_trunc('week')
      d.setDate(d.getDate() + (8 - day));
      return d.toISOString().slice(0, 10);
    }
    const reset = new Date(periodStart);
    reset.setMonth(reset.getMonth() + 1);
    return reset.toISOString().slice(0, 10);
  }

  async recordUsage(args: {
    userId: string;
    promptTokens: number;
    completionTokens: number;
    modelUsed: string;
    isEstimated: boolean;
  }) {
    const total = args.promptTokens + args.completionTokens;
    await this.db.query(
      `INSERT INTO token_usage(user_id, prompt_tokens, completion_tokens, total_tokens, model_used, is_estimated)
       VALUES($1, $2, $3, $4, $5, $6)`,
      [args.userId, args.promptTokens, args.completionTokens, total, args.modelUsed, args.isEstimated],
    );
  }

  @Cron('0 2 * * *')
  async resetMonthlyQuotas() {
    // Catch up multiple elapsed months in one pass (e.g. after downtime or
    // for users who have not logged in for a while).
    await this.db.query(
      `UPDATE user_quota
       SET period_start = (period_start
         + (INTERVAL '1 month' * (
              12 * EXTRACT(YEAR FROM age(CURRENT_DATE, period_start))
              + EXTRACT(MONTH FROM age(CURRENT_DATE, period_start))
           ))
       )::date
       WHERE period_start <= (CURRENT_DATE - INTERVAL '1 month')::date`,
    );
  }
}
