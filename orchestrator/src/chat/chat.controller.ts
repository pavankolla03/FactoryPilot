import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/types';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { ChatService } from './chat.service';

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1),
});

const confirmSchema = z.object({
  actionId: z.string().uuid(),
});

@Controller('/api')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('/chat')
  chat(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = chatSchema.parse(body);
    return this.chatService.chat(user, parsed.conversationId, parsed.message);
  }

  @Post('/chat/confirm-action')
  confirm(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = confirmSchema.parse(body);
    return this.chatService.confirmAction(user, parsed.actionId);
  }

  @Get('/me/usage')
  getUsage(@CurrentUser() user: AuthUser) {
    return this.chatService.getUsage(user.id);
  }
}
