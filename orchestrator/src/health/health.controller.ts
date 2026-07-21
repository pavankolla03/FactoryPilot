import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { HealthService } from './health.service';

@Controller('/api/ops/health')
@UseGuards(AuthGuard)
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Health score for every warehouse the user can see, worst first. */
  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.health.overview(user);
  }

  /** Factor breakdown for one warehouse. */
  @Get('/:warehouseId')
  detail(@CurrentUser() user: AuthUser, @Param('warehouseId') warehouseId: string) {
    return this.health.detail(user, warehouseId);
  }
}
