import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { DbService } from '../common/db.service';
import type { AuthUser, WarehouseScope } from '../common/types';

// @sap/xssec v4 ships no TypeScript types; keep the surface we use narrow.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xssec = require('@sap/xssec') as {
  XsuaaService: new (credentials: Record<string, unknown>) => unknown;
  createSecurityContext: (
    service: unknown,
    config: { jwt: string },
  ) => Promise<{
    getEmail(): string | undefined;
    getGivenName(): string | undefined;
    getFamilyName(): string | undefined;
    getLogonName(): string | undefined;
    checkLocalScope(scope: string): boolean;
  }>;
};

function loadXsuaaCredentials(): Record<string, unknown> | null {
  if (process.env.VCAP_SERVICES) {
    try {
      const vcap = JSON.parse(process.env.VCAP_SERVICES) as Record<
        string,
        Array<{ credentials?: Record<string, unknown> }>
      >;
      const credentials = vcap.xsuaa?.[0]?.credentials;
      if (credentials) {
        return credentials;
      }
    } catch {
      // fall through to XSUAA_* vars
    }
  }

  if (process.env.XSUAA_CLIENTID && process.env.XSUAA_URL) {
    return {
      clientid: process.env.XSUAA_CLIENTID,
      clientsecret: process.env.XSUAA_CLIENTSECRET,
      url: process.env.XSUAA_URL,
      uaadomain: process.env.XSUAA_UAADOMAIN,
      xsappname: process.env.XSUAA_XSAPPNAME || 'manufacturing-agent',
      verificationkey: process.env.XSUAA_VERIFICATION_KEY,
    };
  }

  return null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private xsuaaService: unknown | null = null;

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

    // In xsuaa mode the JWT signature MUST be verified against the bound XSUAA service.
    if (!this.xsuaaService) {
      const credentials = loadXsuaaCredentials();
      if (!credentials) {
        this.logger.error('AUTH_MODE=xsuaa but no XSUAA binding found (VCAP_SERVICES or XSUAA_* env vars)');
        return null;
      }
      this.xsuaaService = new xssec.XsuaaService(credentials);
    }

    let context;
    try {
      context = await xssec.createSecurityContext(this.xsuaaService, { jwt: token });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`XSUAA token validation failed: ${reason}`);
      return null;
    }

    const email = context.getEmail();
    if (!email) {
      return null;
    }

    const isAdmin = context.checkLocalScope('Admin');
    const displayName =
      context.getLogonName() ||
      `${context.getGivenName() || ''} ${context.getFamilyName() || ''}`.trim() ||
      email;
    const role: 'admin' | 'viewer' = isAdmin ? 'admin' : 'viewer';

    const user = await this.ensureUser(email, displayName, role);
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

  private async getScopes(userId: string): Promise<WarehouseScope[]> {
    const rows = await this.db.query<{ warehouse_id: string; access_level: 'read' | 'write' }>(
      'SELECT warehouse_id, access_level FROM user_scopes WHERE user_id = $1',
      [userId],
    );
    return rows.rows.map((r) => ({ warehouseId: r.warehouse_id, accessLevel: r.access_level }));
  }
}
