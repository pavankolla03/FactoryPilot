import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { QuotaService } from '../quota/quota.service';

@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly quota: QuotaService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const raw = (client.handshake.auth?.token || client.handshake.headers.authorization || '') as string;
      const header = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;

      const user = await this.auth.validateBearerToken(header);
      if (!user) {
        client.disconnect(true);
        return;
      }

      client.join(`user:${user.id}`);
      if (user.role === 'admin') {
        client.join('admin');
      }

      const usage = await this.quota.getUsage(user.id);
      client.emit('token_usage:snapshot', {
        used: usage.used,
        limit: usage.limit,
        periodStart: usage.periodStart,
      });
    } catch {
      client.disconnect(true);
      return;
    }
  }

  emitTokenDelta(userId: string, payload: { used: number; limit: number }) {
    this.server.to(`user:${userId}`).emit('token_usage:update', { userId, ...payload });
    this.server.to('admin').emit('token_usage:update', { userId, ...payload });
  }

  emitChatToken(userId: string, payload: { conversationId: string; delta: string }) {
    this.server.to(`user:${userId}`).emit('chat:token', payload);
  }

  emitChatDone(userId: string, payload: { conversationId: string; messageId: string; source: 'cache' | 'live' }) {
    this.server.to(`user:${userId}`).emit('chat:done', payload);
  }

  emitPendingAction(
    userId: string,
    payload: { actionId: string; tool: string; params: Record<string, unknown>; humanSummary: string },
  ) {
    this.server.to(`user:${userId}`).emit('chat:pending_action', payload);
  }

  emitNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  emitSessionLog(payload: unknown) {
    const row = payload as { user_id: string };
    this.server.to(`user:${row.user_id}`).emit('session_log:new', payload);
    this.server.to('admin').emit('session_log:new', payload);
  }
}
