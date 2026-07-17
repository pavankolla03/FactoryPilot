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
              p.auto_approve_max_qty,
              COALESCE(p.maker_checker, false) AS maker_checker,
              u.webhook_url,
              (u.password_hash IS NOT NULL) AS has_password,
              COALESCE(s.scopes, '[]'::json) AS scopes
       FROM users u
       LEFT JOIN user_quota q ON q.user_id = u.id
       LEFT JOIN approval_policies p ON p.user_id = u.id
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

  @Patch('/:id/policy')
  async updatePolicy(@Param('id') id: string, @Body() body: unknown) {
    const parsed = z
      .object({
        auto_approve_max_qty: z.number().int().positive().nullable().optional(),
        maker_checker: z.boolean().optional(),
      })
      .parse(body);

    await this.db.query(
      `INSERT INTO approval_policies(user_id, auto_approve_max_qty, maker_checker)
       VALUES($1, $2, COALESCE($3, false))
       ON CONFLICT (user_id) DO UPDATE SET
         auto_approve_max_qty = CASE WHEN $4 THEN $2 ELSE approval_policies.auto_approve_max_qty END,
         maker_checker = COALESCE($3, approval_policies.maker_checker)`,
      [
        id,
        parsed.auto_approve_max_qty ?? null,
        parsed.maker_checker ?? null,
        parsed.auto_approve_max_qty !== undefined,
      ],
    );

    const row = await this.db.query('SELECT * FROM approval_policies WHERE user_id = $1', [id]);
    return row.rows[0] ?? { user_id: id, auto_approve_max_qty: null, maker_checker: false };
  }

  @Patch('/:id/webhook')
  async updateWebhook(@Param('id') id: string, @Body() body: unknown) {
    const parsed = z.object({ webhook_url: z.string().url().nullable() }).parse(body);
    await this.db.query('UPDATE users SET webhook_url = $1 WHERE id = $2', [parsed.webhook_url, id]);
    return { user_id: id, webhook_url: parsed.webhook_url };
  }

  @Get('/warehouse-policies/list')
  async listWarehousePolicies() {
    const rows = await this.db.query('SELECT * FROM warehouse_policies ORDER BY warehouse_id');
    return rows.rows;
  }

  @Patch('/warehouse-policies/:warehouseId')
  async updateWarehousePolicy(@Param('warehouseId') warehouseId: string, @Body() body: unknown) {
    const parsed = z
      .object({
        auto_approve_max_qty: z.number().int().positive().nullable().optional(),
        maker_checker: z.boolean().optional(),
      })
      .parse(body);

    await this.db.query(
      `INSERT INTO warehouse_policies(warehouse_id, auto_approve_max_qty, maker_checker)
       VALUES($1, $2, COALESCE($3, false))
       ON CONFLICT (warehouse_id) DO UPDATE SET
         auto_approve_max_qty = CASE WHEN $4 THEN $2 ELSE warehouse_policies.auto_approve_max_qty END,
         maker_checker = COALESCE($3, warehouse_policies.maker_checker)`,
      [
        warehouseId,
        parsed.auto_approve_max_qty ?? null,
        parsed.maker_checker ?? null,
        parsed.auto_approve_max_qty !== undefined,
      ],
    );
    const row = await this.db.query('SELECT * FROM warehouse_policies WHERE warehouse_id = $1', [warehouseId]);
    return row.rows[0];
  }

  @Delete('/:id')
  async deleteUser(@Param('id') id: string) {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return { success: true };
  }
}
