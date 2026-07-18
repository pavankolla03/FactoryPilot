import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/roles.guard';
import type { AuthUser } from '../common/types';
import { AgentsService } from './agents.service';
import { ChatService } from '../chat/chat.service';
import { DbService } from '../common/db.service';
import { scopeDenied, throwApiError } from '../common/errors';

const goalSchema = z.object({
  warehouseId: z.string().min(1),
  threshold: z.number().int().positive().optional(),
  autonomy: z.enum(['observe', 'propose', 'act']).optional(),
  dailyBudgetQty: z.number().int().positive().optional(),
  agent: z.enum(['replenishment', 'cycle_count']).optional(),
});

const goalPatchSchema = z.object({
  active: z.boolean().optional(),
  autonomy: z.enum(['observe', 'propose', 'act']).optional(),
  threshold: z.number().int().positive().optional(),
  dailyBudgetQty: z.number().int().positive().optional(),
});

@Controller('/api/agents')
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly chatService: ChatService,
    private readonly db: DbService,
  ) {}

  private async assertWriteScope(user: AuthUser, warehouseId: string) {
    if (user.role === 'admin') {
      return;
    }
    const scope = user.scopes.find((s) => s.warehouseId === warehouseId && s.accessLevel === 'write');
    if (!scope) {
      scopeDenied(`Write access to warehouse ${warehouseId} is required to run agents on it`);
    }
  }

  @Get('/goals')
  @UseGuards(AuthGuard)
  goals(@CurrentUser() user: AuthUser) {
    return this.agents.listGoals(user.id);
  }

  @Post('/goals')
  @UseGuards(AuthGuard)
  async createGoal(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = goalSchema.parse(body);
    await this.assertWriteScope(user, parsed.warehouseId);
    return this.agents.createGoal(user.id, parsed);
  }

  @Patch('/goals/:id')
  @UseGuards(AuthGuard)
  updateGoal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = goalPatchSchema.parse(body);
    return this.agents.updateGoal(user.id, id, parsed);
  }

  @Get('/runs')
  @UseGuards(AuthGuard)
  runs(@CurrentUser() user: AuthUser) {
    return this.agents.listRuns(user.id, user.role === 'admin');
  }

  @Post('/run')
  @UseGuards(AuthGuard)
  async runNow(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = z.object({ warehouseId: z.string().min(1), goalId: z.string().optional() }).parse(body);
    await this.assertWriteScope(user, parsed.warehouseId);

    let goal = null;
    if (parsed.goalId) {
      const goals = await this.agents.listGoals(user.id);
      goal = goals.find((g) => g.id === parsed.goalId) ?? null;
    }
    return this.agents.startRun({
      userId: user.id,
      displayName: user.displayName,
      warehouseId: parsed.warehouseId,
      goal,
      trigger: 'manual',
    });
  }

  @Post('/feedback')
  @UseGuards(AuthGuard)
  async feedback(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = z
      .object({
        conversationId: z.string().uuid().optional(),
        rating: z.union([z.literal(1), z.literal(-1)]),
        comment: z.string().max(500).optional(),
      })
      .parse(body);
    await this.db.query('INSERT INTO feedback(user_id, conversation_id, rating, comment) VALUES($1, $2, $3, $4)', [
      user.id,
      parsed.conversationId ?? null,
      parsed.rating,
      parsed.comment ?? null,
    ]);
    return { success: true };
  }

  /** Admin: run outcome checks now (demo / testing). */
  @Post('/admin/run-outcome-checks')
  @UseGuards(AuthGuard, AdminGuard)
  async runOutcomes() {
    await this.agents.checkOutcomes();
    return { success: true };
  }

  /**
   * One-click approval from webhook channels (beta). The signed token binds
   * the action to its owner; maker-checker still blocks self-approval.
   */
  @Get('/approvals/quick')
  async quickApprove(@Query('token') token: string, @Res() res: Response) {
    const page = (title: string, body: string, ok: boolean) =>
      res
        .status(ok ? 200 : 400)
        .send(
          `<body style="font-family:system-ui;display:grid;place-items:center;height:95vh;background:#F6F8FB">` +
            `<div style="text-align:center;max-width:420px"><h2>${ok ? '✅' : '⚠️'} ${title}</h2><p style="color:#47586E">${body}</p></div></body>`,
        );

    try {
      const secret = process.env.AUTH_JWT_SECRET || process.env.MOCK_JWT_SECRET || 'dev-secret';
      const payload = jwt.verify(token || '', secret) as { actionId: string; sub: string; purpose: string };
      if (payload.purpose !== 'quick-approve') {
        return page('Invalid link', 'This approval link is not valid.', false);
      }

      const row = await this.db.query<{ id: string; email: string; display_name: string; role: 'admin' | 'viewer' }>(
        'SELECT id, email, display_name, role FROM users WHERE id = $1',
        [payload.sub],
      );
      const dbUser = row.rows[0];
      if (!dbUser) {
        return page('Unknown user', 'The approving user no longer exists.', false);
      }
      const scopes = await this.db.query<{ warehouse_id: string; access_level: 'read' | 'write' }>(
        'SELECT warehouse_id, access_level FROM user_scopes WHERE user_id = $1',
        [dbUser.id],
      );
      const user: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        displayName: dbUser.display_name,
        role: dbUser.role,
        scopes: scopes.rows.map((s) => ({ warehouseId: s.warehouse_id, accessLevel: s.access_level })),
      };

      await this.chatService.confirmAction(user, payload.actionId);
      return page('Approved', 'The operation was executed. You can close this tab.', true);
    } catch (error) {
      const reason =
        (error as { response?: { error?: { message?: string } } }).response?.error?.message ||
        (error instanceof Error ? error.message : 'approval failed');
      return page('Not approved', reason, false);
    }
  }

  /**
   * Inbound event webhook — lets external systems (SAP Event Mesh, iFlows,
   * schedulers) trigger agent runs. Authenticated via a shared secret.
   */
  @Post('/events/inbound')
  async inboundEvent(@Headers('x-event-secret') secret: string, @Body() body: unknown) {
    const expected = process.env.EVENT_INBOUND_SECRET;
    if (!expected || secret !== expected) {
      throwApiError(401, 'VALIDATION_ERROR', 'invalid event secret');
    }
    const parsed = z.object({ type: z.string(), warehouseId: z.string().min(1) }).parse(body);
    const result = await this.agents.triggerForWarehouse(parsed.warehouseId, 'event');
    return { received: parsed.type, ...result };
  }
}
