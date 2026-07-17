import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/roles.guard';
import type { AuthUser } from '../common/types';
import { AlertsService } from './alerts.service';

const createAlertSchema = z.object({
  warehouseId: z.string().min(1),
  materialId: z.string().min(1),
  threshold: z.number().int().positive(),
});

@Controller('/api')
@UseGuards(AuthGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('/alerts')
  list(@CurrentUser() user: AuthUser) {
    return this.alerts.listAlerts(user.id);
  }

  @Post('/alerts')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = createAlertSchema.parse(body);
    return this.alerts.createAlert(user, parsed.warehouseId, parsed.materialId, parsed.threshold);
  }

  @Delete('/alerts/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alerts.deleteAlert(user.id, id);
  }

  @Get('/notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.alerts.listNotifications(user.id);
  }

  @Post('/notifications/mark-read')
  markRead(@CurrentUser() user: AuthUser) {
    return this.alerts.markNotificationsRead(user.id);
  }

  /** Admin: trigger the shift-handover digest immediately (demo / testing). */
  @Post('/admin/run-digest')
  @UseGuards(AdminGuard)
  async runDigest() {
    await this.alerts.dailyDigest();
    return { success: true };
  }
}
