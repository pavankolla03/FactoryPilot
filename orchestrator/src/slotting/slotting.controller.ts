import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { scopeDenied } from '../common/errors';
import { SlottingService } from './slotting.service';

@Controller('/api/ops/slotting')
@UseGuards(AuthGuard)
export class SlottingController {
  constructor(private readonly slotting: SlottingService) {}

  /** Slotting relocation proposals for a warehouse (read-scoped). */
  @Get('/:warehouseId')
  proposals(@CurrentUser() user: AuthUser, @Param('warehouseId') warehouseId: string) {
    if (user.role !== 'admin' && !user.scopes.some((s) => s.warehouseId === warehouseId)) {
      scopeDenied(`Warehouse ${warehouseId} is not assigned to your user`);
    }
    return this.slotting.proposals(warehouseId);
  }
}
