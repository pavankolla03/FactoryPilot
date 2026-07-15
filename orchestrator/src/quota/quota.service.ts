import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../common/db.service';
import type { UsageSnapshot } from '../common/types';

@Injectable()
export class QuotaService {
  constructor(private readonly db: DbService) {}

  async getUsage(userId: string): Promise<UsageSnapshot> {
    const result = await this.db.query<{
      used: number;
      monthly_token_limit: number;
      period_start: string;
    }>(
      `SELECT COALESCE(SUM(t.total_tokens), 0)::int AS used,
              q.monthly_token_limit,
              q.period_start::text
       FROM user_quota q
       LEFT JOIN token_usage t ON t.user_id = q.user_id AND t.occurred_at >= q.period_start
       WHERE q.user_id = $1
       GROUP BY q.monthly_token_limit, q.period_start`,
      [userId],
    );

    const row = result.rows[0];
    return {
      used: row?.used ?? 0,
      limit: row?.monthly_token_limit ?? 50000,
      periodStart: row?.period_start || new Date().toISOString().slice(0, 10),
    };
  }

  async isExceeded(userId: string): Promise<{ exceeded: boolean; snapshot: UsageSnapshot }> {
    const snapshot = await this.getUsage(userId);
    return { exceeded: snapshot.used >= snapshot.limit, snapshot };
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
