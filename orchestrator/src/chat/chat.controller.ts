import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/types';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { ChatService } from './chat.service';
import { RedisService } from '../common/redis.service';
import { throwApiError } from '../common/errors';

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
  constructor(
    private readonly chatService: ChatService,
    private readonly redis: RedisService,
  ) {}

  @Post('/chat')
  async chat(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = chatSchema.parse(body);

    // Per-user rate limit: protects both the LLM budget and the SAP path.
    const limit = Number(process.env.CHAT_RATE_LIMIT_PER_MIN || 20);
    const rlKey = `rl:chat:${user.id}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.redis.raw.incr(rlKey);
    if (count === 1) {
      await this.redis.raw.expire(rlKey, 90);
    }
    if (count > limit) {
      throwApiError(429, 'QUOTA_EXCEEDED', `Rate limit reached (${limit} requests/minute) — try again shortly.`);
    }

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
