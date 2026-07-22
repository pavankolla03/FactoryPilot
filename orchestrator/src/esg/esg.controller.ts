import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { EsgService } from './esg.service';

@Controller('/api/ops/esg')
@UseGuards(AuthGuard)
export class EsgController {
  constructor(private readonly esg: EsgService) {}

  /** Per-warehouse carbon footprint with breakdown, intensity and trend. */
  @Get()
  report(@CurrentUser() user: AuthUser) {
    return this.esg.report(user);
  }

  @Get('/export.csv')
  async csv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.esg.csv(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="factorypilot-esg.csv"');
    res.send(csv);
  }
}
