import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DbService } from '../common/db.service';
import { McpService } from '../mcp/mcp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AgentsService } from '../agents/agents.service';
import { validationError } from '../common/errors';
import type { AuthUser } from '../common/types';

export interface StockAlertRow {
  id: string;
  user_id: string;
  warehouse_id: string;
  material_id: string;
  threshold: number;
  active: boolean;
  triggered: boolean;
  created_at: string;
  last_triggered_at: string | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly db: DbService,
    private readonly mcp: McpService,
    private readonly realtime: RealtimeGateway,
    private readonly agents: AgentsService,
  ) {}

  async createAlert(user: AuthUser, warehouseId: string, materialId: string, threshold: number) {
    if (!warehouseId || !materialId || !Number.isFinite(threshold) || threshold <= 0) {
      validationError('warehouseId, materialId and a positive threshold are required');
    }

    const row = await this.db.query<StockAlertRow>(
      `INSERT INTO stock_alerts(user_id, warehouse_id, material_id, threshold)
       VALUES($1, $2, $3, $4)
       RETURNING *`,
      [user.id, warehouseId, materialId, Math.floor(threshold)],
    );
    return row.rows[0];
  }

  async listAlerts(userId: string) {
    const rows = await this.db.query<StockAlertRow>(
      'SELECT * FROM stock_alerts WHERE user_id = $1 AND active = true ORDER BY created_at DESC',
      [userId],
    );
    return rows.rows;
  }

  async deleteAlert(userId: string, alertId: string) {
    await this.db.query('UPDATE stock_alerts SET active = false WHERE id = $1 AND user_id = $2', [
      alertId,
      userId,
    ]);
    return { success: true };
  }

  async listNotifications(userId: string) {
    const rows = await this.db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId],
    );
    return rows.rows;
  }

  async markNotificationsRead(userId: string) {
    await this.db.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [
      userId,
    ]);
    return { success: true };
  }

  /**
   * Every minute: re-evaluate every active alert against live stock (via MCP →
   * iFlow). Fires a notification when the total drops below the threshold and
   * re-arms once stock recovers, so an alert fires again on the next dip.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkAlerts() {
    const alerts = await this.db.query<StockAlertRow>('SELECT * FROM stock_alerts WHERE active = true');

    for (const alert of alerts.rows) {
      try {
        const result = (await this.mcp.callTool('getStockLevel', {
          materialId: alert.material_id,
          warehouseId: alert.warehouse_id,
        })) as { structuredContent?: { records?: Array<{ quantity: number }> } };

        const records = result.structuredContent?.records ?? [];
        const total = records.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

        if (total < alert.threshold && !alert.triggered) {
          await this.db.query(
            'UPDATE stock_alerts SET triggered = true, last_triggered_at = NOW() WHERE id = $1',
            [alert.id],
          );
          await this.notify(
            alert.user_id,
            `Low stock: ${alert.material_id}`,
            `Stock for ${alert.material_id} in warehouse ${alert.warehouse_id} dropped to ${total} (threshold ${alert.threshold}).`,
          );
          // Event-driven autonomy: a firing alert starts the warehouse's replenishment run.
          const triggered = await this.agents.triggerForWarehouse(alert.warehouse_id, 'alert');
          if (triggered.started) {
            this.logger.log(`Alert triggered replenishment run ${triggered.runId} for WH ${alert.warehouse_id}`);
          }
        } else if (total >= alert.threshold && alert.triggered) {
          await this.db.query('UPDATE stock_alerts SET triggered = false WHERE id = $1', [alert.id]);
          await this.notify(
            alert.user_id,
            `Stock recovered: ${alert.material_id}`,
            `Stock for ${alert.material_id} in warehouse ${alert.warehouse_id} is back at ${total} (threshold ${alert.threshold}).`,
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Alert check failed for ${alert.material_id}@${alert.warehouse_id}: ${reason}`);
      }
    }
  }

  private async notify(userId: string, title: string, body: string) {
    const row = await this.db.query(
      'INSERT INTO notifications(user_id, title, body) VALUES($1, $2, $3) RETURNING *',
      [userId, title, body],
    );
    this.realtime.emitNotification(userId, row.rows[0]);
    void this.deliverWebhook(userId, title, body);
  }

  /** Slack/Teams-compatible outbound webhook, fire-and-forget. */
  private async deliverWebhook(userId: string, title: string, body: string) {
    try {
      const row = await this.db.query<{ webhook_url: string | null }>(
        'SELECT webhook_url FROM users WHERE id = $1',
        [userId],
      );
      const url = row.rows[0]?.webhook_url;
      if (!url) {
        return;
      }
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `*${title}*\n${body}` }),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Webhook delivery failed for user ${userId}: ${reason}`);
    }
  }

  async createSchedule(
    userId: string,
    args: { report: string; warehouseId: string | null; hour: number; dayOfWeek: number | null },
  ) {
    if (!['shift_handover', 'usage_summary'].includes(args.report)) {
      validationError("report must be 'shift_handover' or 'usage_summary'");
    }
    if (!Number.isInteger(args.hour) || args.hour < 0 || args.hour > 23) {
      validationError('hour must be 0-23');
    }
    if (args.dayOfWeek !== null && (!Number.isInteger(args.dayOfWeek) || args.dayOfWeek < 0 || args.dayOfWeek > 6)) {
      validationError('dayOfWeek must be 0-6 (0 = Sunday)');
    }

    const row = await this.db.query(
      `INSERT INTO scheduled_reports(user_id, report, warehouse_id, hour, day_of_week)
       VALUES($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, args.report, args.warehouseId, args.hour, args.dayOfWeek],
    );
    return row.rows[0];
  }

  async listSchedules(userId: string) {
    const rows = await this.db.query(
      'SELECT * FROM scheduled_reports WHERE user_id = $1 AND active = true ORDER BY created_at DESC',
      [userId],
    );
    return rows.rows;
  }

  async deleteSchedule(userId: string, scheduleId: string) {
    await this.db.query('UPDATE scheduled_reports SET active = false WHERE id = $1 AND user_id = $2', [
      scheduleId,
      userId,
    ]);
    return { success: true };
  }

  /** Top of every hour: deliver any scheduled reports due now. */
  @Cron('0 * * * *')
  async runScheduledReports() {
    const now = new Date();
    const due = await this.db.query<{
      id: string;
      user_id: string;
      report: string;
      warehouse_id: string | null;
    }>(
      `SELECT id, user_id, report, warehouse_id
       FROM scheduled_reports
       WHERE active = true AND hour = $1 AND (day_of_week IS NULL OR day_of_week = $2)`,
      [now.getHours(), now.getDay()],
    );

    for (const schedule of due.rows) {
      try {
        const { title, body } = await this.buildReport(schedule.user_id, schedule.report, schedule.warehouse_id);
        await this.notify(schedule.user_id, title, body);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Scheduled report ${schedule.id} failed: ${reason}`);
      }
    }
  }

  private async buildReport(userId: string, report: string, warehouseId: string | null) {
    if (report === 'usage_summary') {
      const rows = await this.db.query<{ total: number; requests: string }>(
        `SELECT COALESCE(SUM(total_tokens), 0)::int AS total,
                (SELECT COUNT(*) FROM session_logs WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days') AS requests
         FROM token_usage
         WHERE user_id = $1 AND occurred_at >= NOW() - INTERVAL '7 days'`,
        [userId],
      );
      const stat = rows.rows[0];
      return {
        title: 'Weekly usage summary',
        body: `Last 7 days: ${Number(stat?.total || 0).toLocaleString()} tokens across ${stat?.requests || 0} requests.`,
      };
    }

    const warehouses = warehouseId
      ? [warehouseId]
      : (await this.warehousesFor(userId, 'admin')).slice(0, 3);
    const lines: string[] = [];
    for (const wh of warehouses) {
      const movements = (await this.mcp.callTool('getRecentMovements', {
        warehouseId: wh,
        sinceHours: 24,
      })) as { structuredContent?: { records?: unknown[] } };
      const low = (await this.mcp.callTool('getLowStock', { warehouseId: wh, threshold: 50 })) as {
        structuredContent?: { records?: unknown[] };
      };
      lines.push(
        `WH ${wh}: ${movements.structuredContent?.records?.length ?? 0} movements in 24h, ` +
          `${low.structuredContent?.records?.length ?? 0} low-stock positions`,
      );
    }
    return { title: 'Scheduled shift handover', body: lines.join('\n') || 'No warehouse activity found.' };
  }

  /** 06:00 daily shift-handover digest for every user with warehouse access. */
  @Cron('0 6 * * *')
  async dailyDigest() {
    const users = await this.db.query<{ id: string; role: string }>(
      `SELECT DISTINCT u.id, u.role
       FROM users u
       LEFT JOIN user_scopes s ON s.user_id = u.id
       WHERE u.role = 'admin' OR s.id IS NOT NULL`,
    );

    for (const user of users.rows) {
      try {
        const warehouses = await this.warehousesFor(user.id, user.role);
        const lines: string[] = [];

        for (const wh of warehouses.slice(0, 3)) {
          const result = (await this.mcp.callTool('getRecentMovements', {
            warehouseId: wh,
            sinceHours: 24,
          })) as { structuredContent?: { records?: unknown[] } };
          const count = result.structuredContent?.records?.length ?? 0;
          lines.push(`WH ${wh}: ${count} movement${count === 1 ? '' : 's'} in the last 24h`);
        }

        const triggered = await this.db.query<{ count: string }>(
          'SELECT COUNT(*)::int AS count FROM stock_alerts WHERE user_id = $1 AND active = true AND triggered = true',
          [user.id],
        );
        const alertCount = Number(triggered.rows[0]?.count || 0);
        if (alertCount > 0) {
          lines.push(`${alertCount} stock alert${alertCount === 1 ? '' : 's'} currently below threshold`);
        }

        if (lines.length > 0) {
          await this.notify(user.id, 'Shift handover digest', lines.join('\n'));
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Digest failed for user ${user.id}: ${reason}`);
      }
    }
  }

  private async warehousesFor(userId: string, role: string): Promise<string[]> {
    if (role !== 'admin') {
      const rows = await this.db.query<{ warehouse_id: string }>(
        'SELECT DISTINCT warehouse_id FROM user_scopes WHERE user_id = $1',
        [userId],
      );
      return rows.rows.map((r) => r.warehouse_id);
    }
    const rows = await this.db.query<{ warehouse_id: string }>(
      `SELECT DISTINCT warehouse_id FROM (
         SELECT warehouse_id FROM user_scopes
         UNION SELECT warehouse_id FROM stock_alerts WHERE active = true
       ) w`,
    );
    return rows.rows.length ? rows.rows.map((r) => r.warehouse_id) : ['1010'];
  }
}
