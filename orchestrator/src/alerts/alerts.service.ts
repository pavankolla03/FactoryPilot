import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DbService } from '../common/db.service';
import { McpService } from '../mcp/mcp.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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
