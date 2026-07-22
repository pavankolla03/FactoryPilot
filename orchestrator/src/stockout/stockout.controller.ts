import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { StockoutService } from './stockout.service';

@Controller('/api/ops/stockout-radar')
@UseGuards(AuthGuard)
export class StockoutController {
  constructor(private readonly stockout: StockoutService) {}

  /** Ranked stockout radar across the user's in-scope warehouses. */
  @Get()
  radar(@CurrentUser() user: AuthUser) {
    return this.stockout.radar(user);
  }
}
