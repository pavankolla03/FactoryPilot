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
  }
}
