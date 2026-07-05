import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { DbService } from '../common/db.service';

@WebSocketGateway({ path: '/ws', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly db: DbService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    const token = (client.handshake.auth?.token || client.handshake.headers.authorization || '') as string;
    const pure = token.startsWith('Bearer ') ? token.slice(7) : token;

    const mode = process.env.AUTH_MODE || 'xsuaa';
    let payload: { sub?: string; email?: string; role?: 'admin' | 'viewer' } | null = null;

    if (mode === 'mock') {
      payload = jwt.verify(pure, process.env.MOCK_JWT_SECRET || 'dev-secret') as {
        sub?: string;
        email?: string;
        role?: 'admin' | 'viewer';
      };
    } else {
      payload = jwt.decode(pure) as { sub?: string; email?: string; role?: 'admin' | 'viewer' } | null;
    }

    if (!payload?.sub && !payload?.email) {
      client.disconnect(true);
      return;
    }

    const row = await this.db.query<{
      id: string;
      role: 'admin' | 'viewer';
      monthly_token_limit: number;
      period_start: string;
      used: number;
    }>(
      `SELECT u.id,
              u.role,
              q.monthly_token_limit,
              q.period_start,
              COALESCE(SUM(t.total_tokens), 0)::int AS used
       FROM users u
       LEFT JOIN user_quota q ON q.user_id = u.id
       LEFT JOIN token_usage t ON t.user_id = u.id AND t.occurred_at >= q.period_start
       WHERE u.id = COALESCE($1::uuid, (SELECT id FROM users WHERE email = $2 LIMIT 1))
       GROUP BY u.id, u.role, q.monthly_token_limit, q.period_start`,
      [payload.sub || null, payload.email || null],
    );

    const user = row.rows[0];
    if (!user) {
      client.disconnect(true);
      return;
    }

    client.join(`user:${user.id}`);
    if (user.role === 'admin') {
      client.join('admin');
    }

    client.emit('token_usage:snapshot', {
      used: user.used,
      limit: user.monthly_token_limit,
      periodStart: user.period_start,
    });
  }

  emitTokenDelta(userId: string, payload: { used: number; limit: number }) {
    this.server.to(`user:${userId}`).emit('token_usage:update', payload);
    this.server.to('admin').emit('token_usage:update', payload);
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

  emitSessionLog(payload: unknown) {
    const row = payload as { user_id: string };
    this.server.to(`user:${row.user_id}`).emit('session_log:new', payload);
    this.server.to('admin').emit('session_log:new', payload);
  }
}
