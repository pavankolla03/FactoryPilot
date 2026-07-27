import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/roles.guard';
import type { AuthUser } from '../common/types';
import { BusinessObjectsService } from './business-objects.service';

const upsertSchema = z.object({
  object_code: z.string().min(1),
  object_name: z.string().min(1),
  keywords: z.string().optional(),
  destination_name: z.string().nullable().optional(),
  odata_service_path: z.string().min(1),
  entity_set: z.string().min(1),
  default_filters: z.string().nullable().optional(),
  select_fields: z.string().nullable().optional(),
  date_field: z.string().nullable().optional(),
  status_field: z.string().nullable().optional(),
  group_by: z.string().nullable().optional(),
  api_version: z.enum(['v2', 'v4']).optional(),
  top_limit: z.number().int().positive().max(500).optional(),
  is_active: z.boolean().optional(),
});

const patchSchema = upsertSchema.partial();

@Controller('/api/admin/business-objects')
@UseGuards(AuthGuard, AdminGuard)
export class BusinessObjectsController {
  constructor(private readonly service: BusinessObjectsService) {}

  @Get('/list')
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.service.create(user, upsertSchema.parse(body));
  }

  @Patch('/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.service.update(user, id, patchSchema.parse(body));
  }

  @Delete('/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.remove(user, id);
    return { success: true };
  }

  @Post('/:id/test-connection')
  testConnection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.testConnection(user, id);
  }

  /**
   * Field discovery: fetch a few real rows so a consultant configuring this
   * object can see which fields SAP actually returns before mapping them.
   */
  @Post('/:id/preview')
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.preview(user, id);
  }
}
