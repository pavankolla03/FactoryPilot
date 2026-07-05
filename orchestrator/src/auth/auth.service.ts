import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { DbService } from '../common/db.service';
import type { AuthUser } from '../common/types';

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService) {}

  async validateBearerToken(authHeader?: string): Promise<AuthUser | null> {
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice('Bearer '.length);
    const mode = process.env.AUTH_MODE || 'xsuaa';

    if (mode === 'mock') {
      const secret = process.env.MOCK_JWT_SECRET || 'dev-secret';
      const decoded = jwt.verify(token, secret) as {
        sub: string;
        email: string;
        displayName: string;
        role: 'admin' | 'viewer';
      };

      const user = await this.ensureUser(decoded.email, decoded.displayName, decoded.role);
      const scopes = await this.getScopes(user.id);
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        scopes,
      };
    }

    // In xsuaa mode, expect JWT forwarded by approuter. Use @sap/xssec in production setup.
    const decoded = jwt.decode(token) as
      | {
          email?: string;
          user_name?: string;
          given_name?: string;
          family_name?: string;
          scope?: string[];
          sub?: string;
          xs_rolecollections?: string[];
        }
      | null;

    if (!decoded?.email) {
      return null;
    }

    const isAdmin =
      decoded.xs_rolecollections?.some((r) => r.toLowerCase().includes('admin')) ||
      decoded.scope?.some((s) => s.toLowerCase().includes('admin'));

    const displayName =
      decoded.user_name || `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim() || decoded.email;
    const role: 'admin' | 'viewer' = isAdmin ? 'admin' : 'viewer';

    const user = await this.ensureUser(decoded.email, displayName, role);
    const scopes = await this.getScopes(user.id);

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      scopes,
    };
  }

  async createMockToken(email: string, displayName: string, role: 'admin' | 'viewer') {
    const user = await this.ensureUser(email, displayName, role);
    const secret = process.env.MOCK_JWT_SECRET || 'dev-secret';
    const token = jwt.sign({ sub: user.id, email, displayName, role }, secret, { expiresIn: '12h' });
    return { token, user };
  }

  private async ensureUser(email: string, displayName: string, role: 'admin' | 'viewer') {
    const existing = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'viewer';
    }>('SELECT id, email, display_name, role FROM users WHERE email = $1', [email]);

    if (existing.rows[0]) {
      if (existing.rows[0].display_name !== displayName || existing.rows[0].role !== role) {
        await this.db.query('UPDATE users SET display_name = $1, role = $2 WHERE id = $3', [
          displayName,
          role,
          existing.rows[0].id,
        ]);
      }
      return {
        ...existing.rows[0],
        display_name: displayName,
        role,
      };
    }

    const inserted = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'viewer';
    }>(
      'INSERT INTO users(email, display_name, role) VALUES($1, $2, $3) RETURNING id, email, display_name, role',
      [email, displayName, role],
    );

    await this.db.query(
      'INSERT INTO user_quota(user_id, monthly_token_limit, period_start) VALUES($1, $2, CURRENT_DATE) ON CONFLICT (user_id) DO NOTHING',
      [inserted.rows[0].id, 50000],
    );

    return inserted.rows[0];
  }

  private async getScopes(userId: string): Promise<string[]> {
    const rows = await this.db.query<{ warehouse_id: string }>(
      'SELECT warehouse_id FROM user_scopes WHERE user_id = $1',
      [userId],
    );
    return rows.rows.map((r) => r.warehouse_id);
  }
}
