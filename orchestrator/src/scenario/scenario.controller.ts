import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { scopeDenied } from '../common/errors';
import { ScenarioService } from './scenario.service';

const scenarioSchema = z.object({
  warehouseId: z.string().min(1),
  demandMultiplier: z.number().positive().max(5).optional(),
  horizonDays: z.number().int().positive().max(90).optional(),
  supplierDelayDays: z.number().int().min(0).max(60).optional(),
});

@Controller('/api/ops/scenario')
@UseGuards(AuthGuard)
export class ScenarioController {
  constructor(private readonly scenario: ScenarioService) {}

  /** Whole-warehouse what-if projection (read-scoped, zero writes). */
  @Post()
  project(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = scenarioSchema.parse(body);
    if (user.role !== 'admin' && !user.scopes.some((s) => s.warehouseId === parsed.warehouseId)) {
      scopeDenied(`Warehouse ${parsed.warehouseId} is not assigned to your user`);
    }
    return this.scenario.project(parsed.warehouseId, {
      demandMultiplier: parsed.demandMultiplier ?? 1,
      horizonDays: parsed.horizonDays ?? 14,
      supplierDelayDays: parsed.supplierDelayDays ?? 0,
    });
  }
}
