import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { LandscapeService } from './landscape.service';
import { ConnectionsService } from '../connections/connections.service';

@Controller('/api/ops/landscape')
@UseGuards(AuthGuard)
export class LandscapeController {
  constructor(
    private readonly landscape: LandscapeService,
    private readonly connections: ConnectionsService,
  ) {}

  /**
   * Whether approved writes will actually reach SAP (Phase AP). The approval
   * card asks before showing an Approve button, so an operator is warned that a
   * movement stays local rather than finding out afterwards.
   */
  @Get('/write-target')
  async writeTarget(@CurrentUser() user: AuthUser) {
    const write = await this.connections.resolveActive('iflow-write', user.orgId).catch(() => null);
    return { connected: Boolean(write), target: write ? 'sap' : 'local' };
  }

  /** Plants the user can pick, flagged live vs demo. */
  @Get('/plants')
  async plants(@CurrentUser() user: AuthUser) {
    const all = await this.landscape.plants(user.orgId);
    if (user.role === 'admin') {
      return all;
    }
    const set = new Set(user.scopes.map((s) => s.warehouseId));
    return all.filter((p) => set.has(p.warehouseId));
  }

  /** Live-vs-simulated coverage per business object. */
  @Get('/coverage')
  coverage(@CurrentUser() user: AuthUser) {
    return this.landscape.coverage(user.orgId);
  }
}
