import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { scopeDenied } from '../common/errors';
import { ConnectionsService } from './connections.service';

const createSchema = z.object({
  kind: z.enum(['iflow', 'iflow-write', 's4hana', 'btp']),
  name: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
  active: z.boolean().optional(),
});

/** Connection Center (Phase AD) — admin-only landscape management. */
@Controller('/api/admin/connections')
@UseGuards(AuthGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'admin') {
      scopeDenied('Only administrators can manage system connections');
    }
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    return this.connections.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    this.assertAdmin(user);
    const parsed = createSchema.parse(body);
    return this.connections.create(user, {
      kind: parsed.kind,
      name: parsed.name,
      config: (parsed.config ?? {}) as Record<string, unknown>,
      secrets: parsed.secrets,
    });
  }

  @Patch('/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    this.assertAdmin(user);
    const parsed = updateSchema.parse(body);
    return this.connections.update(user, id, parsed as Parameters<ConnectionsService['update']>[2]);
  }

  @Delete('/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.connections.remove(user, id);
  }

  @Post('/:id/test')
  test(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.connections.test(user, id);
  }
}
