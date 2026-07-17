import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { ChatService } from '../chat/chat.service';

const moveRequestSchema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
  qty: z.number().int().positive(),
});

@Controller('/api/ops')
@UseGuards(AuthGuard)
export class OpsController {
  constructor(private readonly chatService: ChatService) {}

  /** Live stock for the kanban operations board, grouped by location. */
  @Get('/board')
  board(@CurrentUser() user: AuthUser, @Query('warehouseId') warehouseId: string) {
    return this.chatService.getWarehouseBoard(user, warehouseId);
  }

  /**
   * Drag-and-drop move request from the board. Goes through the same policy,
   * anomaly, and approval machinery as chat-initiated writes.
   */
  @Post('/move-request')
  moveRequest(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = moveRequestSchema.parse(body);
    return this.chatService.proposeMove(user, parsed);
  }
}
