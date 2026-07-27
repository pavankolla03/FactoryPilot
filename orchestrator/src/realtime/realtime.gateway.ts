import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { QuotaService } from '../quota/quota.service';

/** One tool invocation inside an agent turn, as shown in the chat activity timeline. */
export type ChatToolEvent = {
  id: string;
  tool: string;
  server: string;
  args?: Record<string, unknown>;
  ms?: number;
  cacheHit?: boolean;
  /** Which system actually answered: 'sap-iflow (live)', 'simulator', … */
  dataSource?: string;
  /** True when the record came from the customer's connected SAP landscape. */
  live?: boolean;
  /** Serialized payload size handed to the model, in bytes. */
  bytes?: number;
  /**
   * Expandable request detail, so a user can see exactly which endpoint was
   * called and what came back — the "why should I believe this answer" trail.
   */
  detail?: {
    /** Endpoint actually hit, e.g. the iFlow URL path. */
    endpoint?: string;
    entitySet?: string;
    /** Rows SAP returned, before any row budget was applied. */
    rowCount?: number;
    /** A few real rows from the response. */
    sample?: Array<Record<string, unknown>>;
    /** Set when the payload could not answer the question as asked. */
    unavailableReason?: string;
  };
  status: 'ok' | 'error' | 'pending';
};

export type ChatTurnStats = {
  elapsedMs: number;
  rounds: number;
  toolCount: number;
  model: string;
  tokens: number;
  /** Turn-level data provenance across all tools used. */
  provenance?: 'live' | 'stale' | 'simulator' | 'mixed' | 'none';
};

export type ChatStatusPayload = {
  conversationId: string;
  /** `stream_reset` tells the client to discard the partial reply it has buffered. */
  kind: 'thinking' | 'tool_start' | 'tool_end' | 'stream_reset';
  round?: number;
} & Partial<ChatToolEvent>;

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

  emitChatDone(
    userId: string,
    payload: {
      conversationId: string;
      messageId: string;
      source: 'cache' | 'live';
      grounded?: boolean;
      stats?: ChatTurnStats;
      toolEvents?: ChatToolEvent[];
    },
  ) {
    this.server.to(`user:${userId}`).emit('chat:done', payload);
  }

  /** Live agent-loop progress: thinking rounds and per-tool start/end events. */
  emitChatStatus(userId: string, payload: ChatStatusPayload) {
    this.server.to(`user:${userId}`).emit('chat:status', payload);
  }

  emitPendingAction(
    userId: string,
    payload: { actionId: string; tool: string; params: Record<string, unknown>; humanSummary: string },
  ) {
    // Admins also see pending approvals (needed for maker-checker sign-off).
    this.server.to(`user:${userId}`).to('admin').emit('chat:pending_action', payload);
  }

  emitNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  emitAgentRun(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).to('admin').emit('agent_run:update', payload);
  }

  emitSessionLog(payload: unknown) {
    const row = payload as { user_id: string };
    this.server.to(`user:${row.user_id}`).emit('session_log:new', payload);
    this.server.to('admin').emit('session_log:new', payload);
  }
}
