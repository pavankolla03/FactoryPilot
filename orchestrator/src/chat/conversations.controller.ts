import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthUser } from '../common/types';
import { DbService } from '../common/db.service';

@Controller('/api/conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly db: DbService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.db.query(
      `SELECT c.id,
              c.title,
              c.created_at,
              MAX(m.created_at) AS last_activity,
              COUNT(m.id) FILTER (
                WHERE m.role IN ('user', 'assistant') AND btrim(m.content, E' \t\n\r') <> ''
              )::int AS message_count
       FROM conversations c
       LEFT JOIN conversation_messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id, c.title, c.created_at
       ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
       LIMIT 50`,
      [user.id],
    );
    return rows.rows;
  }

  @Get('/:id/messages')
  async messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('includeTools') includeTools?: string,
  ) {
    // Admins may inspect any conversation for audit drill-down.
    const owner = await this.db.query(
      user.role === 'admin'
        ? 'SELECT id FROM conversations WHERE id = $1'
        : 'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      user.role === 'admin' ? [id] : [id, user.id],
    );
    if (!owner.rows[0]) {
      throw new NotFoundException({ error: { code: 'VALIDATION_ERROR', message: 'conversation not found' } });
    }

    if (includeTools === '1') {
      const rows = await this.db.query(
        `SELECT role, content, tool_calls_json, created_at
         FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [id],
      );
      return rows.rows;
    }

    const rows = await this.db.query<{ role: string; content: string; created_at: string }>(
      `SELECT role, content, created_at
       FROM conversation_messages
       WHERE conversation_id = $1
         AND role IN ('user', 'assistant')
         AND btrim(content, E' \t\n\r') <> ''
       ORDER BY created_at ASC`,
      [id],
    );
    return rows.rows;
  }
}
