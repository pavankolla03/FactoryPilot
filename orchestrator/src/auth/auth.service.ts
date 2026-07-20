import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DbService } from '../common/db.service';
import { throwApiError } from '../common/errors';
import { openSecret, sealSecret } from '../common/secret-box';
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

    if (mode === 'local') {
      let decoded: { sub: string };
      try {
        decoded = jwt.verify(token, this.jwtSecret()) as { sub: string };
      } catch {
        return null;
      }

      const row = await this.db.query<{
        id: string;
        email: string;
        display_name: string;
        role: 'admin' | 'viewer';
        org_id: string | null;
      }>('SELECT id, email, display_name, role, org_id FROM users WHERE id = $1', [decoded.sub]);
      const user = row.rows[0];
      if (!user) {
        return null;
      }

      const scopes = await this.getScopes(user.id);
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        scopes,
        orgId: user.org_id,
      };
    }

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

  private jwtSecret() {
    return process.env.AUTH_JWT_SECRET || process.env.MOCK_JWT_SECRET || 'dev-secret';
  }

  private issueToken(user: { id: string; email: string; role: 'admin' | 'viewer' }) {
    return jwt.sign({ sub: user.id, email: user.email, role: user.role }, this.jwtSecret(), {
      expiresIn: '12h',
    });
  }

  async signup(
    email: string,
    displayName: string,
    password: string,
    orgName?: string,
    joinCode?: string,
  ) {
    const existing = await this.db.query<{ id: string; password_hash: string | null }>(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email],
    );
    if (existing.rows[0]?.password_hash) {
      throwApiError(409, 'VALIDATION_ERROR', 'An account with this email already exists — sign in instead.');
    }

    // Multi-tenancy (beta):
    //  - a join code puts the account into that organization as an operator
    //  - an explicit orgName creates a fresh organization with this user as its admin
    //  - neither (legacy path) joins the oldest org with the original first-admin rule
    let orgId: string;
    let role: 'admin' | 'viewer';
    if (joinCode) {
      const org = await this.db.query<{ id: string }>('SELECT id FROM organizations WHERE join_code = $1', [joinCode]);
      if (!org.rows[0]) {
        throwApiError(404, 'VALIDATION_ERROR', 'Unknown organization join code.');
      }
      orgId = org.rows[0].id;
      role = 'viewer';
    } else if (orgName) {
      const org = await this.db.query<{ id: string }>('INSERT INTO organizations(name) VALUES($1) RETURNING id', [
        orgName,
      ]);
      orgId = org.rows[0].id;
      role = 'admin';
    } else {
      const org = await this.db.query<{ id: string }>('SELECT id FROM organizations ORDER BY created_at LIMIT 1');
      orgId = org.rows[0].id;
      const admins = await this.db.query<{ count: string }>(
        "SELECT COUNT(*)::int AS count FROM users WHERE password_hash IS NOT NULL AND role = 'admin' AND org_id = $1",
        [orgId],
      );
      role = Number(admins.rows[0]?.count || 0) === 0 ? 'admin' : 'viewer';
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user: { id: string; email: string; display_name: string; role: 'admin' | 'viewer' };
    if (existing.rows[0]) {
      const updated = await this.db.query<typeof user>(
        `UPDATE users SET display_name = $1, role = $2, password_hash = $3, org_id = $5
         WHERE id = $4
         RETURNING id, email, display_name, role`,
        [displayName, role, passwordHash, existing.rows[0].id, orgId],
      );
      user = updated.rows[0];
    } else {
      const inserted = await this.db.query<typeof user>(
        `INSERT INTO users(email, display_name, role, password_hash, org_id)
         VALUES($1, $2, $3, $4, $5)
         RETURNING id, email, display_name, role`,
        [email, displayName, role, passwordHash, orgId],
      );
      user = inserted.rows[0];
    }

    await this.db.query(
      'INSERT INTO user_quota(user_id, monthly_token_limit, period_start) VALUES($1, $2, CURRENT_DATE) ON CONFLICT (user_id) DO NOTHING',
      [user.id, 50000],
    );

    const org = await this.db.query<{ name: string; join_code: string }>(
      'SELECT name, join_code FROM organizations WHERE id = $1',
      [orgId],
    );
    return { token: this.issueToken(user), user, organization: org.rows[0] };
  }

  async login(email: string, password: string) {
    const row = await this.db.query<{
      id: string;
      email: string;
      display_name: string;
      role: 'admin' | 'viewer';
      password_hash: string | null;
    }>('SELECT id, email, display_name, role, password_hash FROM users WHERE email = $1', [email]);

    const user = row.rows[0];
    const valid = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
      throwApiError(401, 'VALIDATION_ERROR', 'Invalid email or password.');
    }

    const org = await this.db.query<{ name: string; join_code: string }>(
      'SELECT o.name, o.join_code FROM organizations o JOIN users u ON u.org_id = o.id WHERE u.id = $1',
      [user.id],
    );
    return {
      token: this.issueToken(user),
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
      organization: org.rows[0] ?? null,
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

  // ---------- API keys (programmatic Otto access, Phase B) ----------

  async createApiKey(userId: string, name: string) {
    const secret = `fp_live_${jwt.sign({ r: Math.random() }, this.jwtSecret()).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
    const prefix = secret.slice(0, 12);
    const keyHash = await bcrypt.hash(secret, 10);
    const row = await this.db.query<{ id: string; name: string; prefix: string; created_at: string }>(
      'INSERT INTO api_keys(user_id, name, prefix, key_hash) VALUES($1, $2, $3, $4) RETURNING id, name, prefix, created_at',
      [userId, name || 'API key', prefix, keyHash],
    );
    // The full secret is shown exactly once.
    return { ...row.rows[0], key: secret };
  }

  async listApiKeys(userId: string) {
    const rows = await this.db.query(
      'SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = $1 AND revoked = false ORDER BY created_at DESC',
      [userId],
    );
    return rows.rows;
  }

  async revokeApiKey(userId: string, id: string) {
    await this.db.query('UPDATE api_keys SET revoked = true WHERE id = $1 AND user_id = $2', [id, userId]);
    return { success: true };
  }

  // ---------- BYOM: user-registered models (beta, Phase M) ----------

  async listUserModels(userId: string) {
    const rows = await this.db.query(
      `SELECT id, name, base_url, model_id, purpose, active, created_at, last_used_at
       FROM user_models WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    return rows.rows;
  }

  async addUserModel(
    userId: string,
    m: { name: string; baseUrl: string; modelId: string; apiKey: string; purpose?: string },
  ) {
    const row = await this.db.query(
      `INSERT INTO user_models(user_id, name, base_url, model_id, api_key_enc, purpose)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id, name, base_url, model_id, purpose, active, created_at`,
      [userId, m.name, m.baseUrl.replace(/\/$/, ''), m.modelId, sealSecret(m.apiKey), m.purpose ?? 'chat'],
    );
    return row.rows[0];
  }

  async toggleUserModel(userId: string, id: string, active: boolean) {
    await this.db.query('UPDATE user_models SET active = $1 WHERE id = $2 AND user_id = $3', [active, id, userId]);
    return { success: true };
  }

  async deleteUserModel(userId: string, id: string) {
    await this.db.query('DELETE FROM user_models WHERE id = $1 AND user_id = $2', [id, userId]);
    return { success: true };
  }

  /** Decrypted configs for routing — internal use only, never returned by the API. */
  async activeUserModelConfigs(userId: string) {
    const rows = await this.db.query<{ id: string; name: string; base_url: string; model_id: string; api_key_enc: string }>(
      'SELECT id, name, base_url, model_id, api_key_enc FROM user_models WHERE user_id = $1 AND active = true ORDER BY created_at ASC',
      [userId],
    );
    const configs = [];
    for (const r of rows.rows) {
      try {
        configs.push({ id: r.id, name: r.name, baseUrl: r.base_url, modelId: r.model_id, apiKey: openSecret(r.api_key_enc) });
      } catch {
        // Key sealed under a rotated secret — skip rather than fail the chat.
      }
    }
    return configs;
  }

  async validateApiKey(key: string): Promise<AuthUser | null> {
    if (!key || !key.startsWith('fp_live_')) {
      return null;
    }
    const prefix = key.slice(0, 12);
    const rows = await this.db.query<{ id: string; user_id: string; key_hash: string }>(
      'SELECT id, user_id, key_hash FROM api_keys WHERE prefix = $1 AND revoked = false',
      [prefix],
    );
    for (const row of rows.rows) {
      if (await bcrypt.compare(key, row.key_hash)) {
        await this.db.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]);
        const u = await this.db.query<{
          id: string;
          email: string;
          display_name: string;
          role: 'admin' | 'viewer';
          org_id: string | null;
        }>('SELECT id, email, display_name, role, org_id FROM users WHERE id = $1', [row.user_id]);
        const user = u.rows[0];
        if (!user) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          scopes: await this.getScopes(user.id),
          orgId: user.org_id,
        };
      }
    }
    return null;
  }
}
