import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../auth/roles.guard';
import { DbService } from '../common/db.service';

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  role: z.enum(['admin', 'viewer']),
  monthly_token_limit: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'viewer']).optional(),
  display_name: z.string().min(1).optional(),
});

const scopesSchema = z.object({
  scopes: z.array(z.object({ warehouse_id: z.string(), access_level: z.enum(['read', 'write']) })),
});

const quotaSchema = z.object({
  monthly_token_limit: z.number().int().positive(),
});

@Controller('/api/admin/users')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly db: DbService) {}

  @Get()
  async listUsers() {
    const users = await this.db.query(
      `SELECT u.id,
              u.email,
              u.display_name,
              u.role,
              u.created_at,
              COALESCE(q.monthly_token_limit, 50000) AS monthly_token_limit,
              COALESCE(s.scopes, '[]'::json) AS scopes
       FROM users u
       LEFT JOIN user_quota q ON q.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                json_agg(json_build_object('warehouse_id', warehouse_id, 'access_level', access_level)) AS scopes
         FROM user_scopes
         GROUP BY user_id
       ) s ON s.user_id = u.id
       ORDER BY u.created_at DESC`,
    );
    return users.rows;
  }

  @Post()
  async createUser(@Body() body: unknown) {
    const parsed = createUserSchema.parse(body);
    const row = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'viewer';
      created_at: string;
    }>(
      `INSERT INTO users(email, display_name, role)
       VALUES($1, $2, $3)
       RETURNING id, email, display_name, role, created_at`,
      [parsed.email, parsed.display_name, parsed.role],
    );

    await this.db.query(
      `INSERT INTO user_quota(user_id, monthly_token_limit, period_start)
       VALUES($1, $2, CURRENT_DATE)
       ON CONFLICT (user_id)
       DO UPDATE SET monthly_token_limit = EXCLUDED.monthly_token_limit`,
      [row.rows[0].id, parsed.monthly_token_limit ?? 50000],
    );

    return row.rows[0];
  }

  @Patch('/:id')
  async updateUser(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateUserSchema.parse(body);
    await this.db.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           role = COALESCE($2, role)
       WHERE id = $3`,
      [parsed.display_name ?? null, parsed.role ?? null, id],
    );

    const row = await this.db.query('SELECT id, email, display_name, role, created_at FROM users WHERE id = $1', [id]);
    return row.rows[0];
  }

  @Patch('/:id/scopes')
  async replaceScopes(@Param('id') id: string, @Body() body: unknown) {
    const parsed = scopesSchema.parse(body);
    await this.db.query('DELETE FROM user_scopes WHERE user_id = $1', [id]);

    for (const scope of parsed.scopes) {
      await this.db.query(
        'INSERT INTO user_scopes(user_id, warehouse_id, access_level) VALUES($1, $2, $3)',
        [id, scope.warehouse_id, scope.access_level],
      );
    }

    const scopes = await this.db.query(
      'SELECT id, user_id, warehouse_id, access_level FROM user_scopes WHERE user_id = $1',
      [id],
    );
    return scopes.rows;
  }

  @Patch('/:id/quota')
  async updateQuota(@Param('id') id: string, @Body() body: unknown) {
    const parsed = quotaSchema.parse(body);
    await this.db.query(
      `INSERT INTO user_quota(user_id, monthly_token_limit, period_start)
       VALUES($1, $2, CURRENT_DATE)
       ON CONFLICT (user_id)
       DO UPDATE SET monthly_token_limit = EXCLUDED.monthly_token_limit`,
      [id, parsed.monthly_token_limit],
    );

    const quota = await this.db.query(
      'SELECT user_id, monthly_token_limit, period_start FROM user_quota WHERE user_id = $1',
      [id],
    );
    return quota.rows[0];
  }

  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return { success: true };
  }
}
