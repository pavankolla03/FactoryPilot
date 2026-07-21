import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { SuppliersService } from './suppliers.service';

@Controller('/api/ops/suppliers')
@UseGuards(AuthGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  /** Supplier scorecards ranked worst-first (biggest reliability risk on top). */
  @Get()
  scorecards(@CurrentUser() user: AuthUser) {
    return this.suppliers.scorecards(user);
  }
}
