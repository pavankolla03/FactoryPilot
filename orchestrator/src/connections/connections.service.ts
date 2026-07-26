import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import { sealSecret, openSecret } from '../common/secret-box';
import { validationError } from '../common/errors';
import { SapIflowClient, type IflowOverride } from '../business-objects/sap-iflow.client';
import type { AuthUser } from '../common/types';

export type ConnectionKind = 'iflow' | 'iflow-write' | 's4hana' | 'btp';

export interface ConnectionRow {
  id: string;
  org_id: string | null;
  kind: ConnectionKind;
  name: string;
  config: Record<string, unknown>;
  secrets_enc: string | null;
  active: boolean;
  status: string;
  last_message: string | null;
  last_tested_at: string | null;
}

/** What the UI receives — secrets never leave the server, only a masked hint. */
export interface ConnectionView extends Omit<ConnectionRow, 'secrets_enc' | 'org_id'> {
  secretHints: Record<string, string>;
}

/** Resolved config (config + decrypted secrets) for internal callers. */
export type ResolvedConnection = { id: string; name: string; kind: ConnectionKind } & Record<string, unknown>;

const SECRET_FIELDS: Record<ConnectionKind, string[]> = {
  iflow: ['password', 'apiKey', 'clientSecret'],
  'iflow-write': ['password', 'apiKey', 'clientSecret'],
  s4hana: ['apiKey', 'password', 'clientSecret'],
  btp: ['clientSecret'],
};

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  private readonly iflow = new SapIflowClient();

  constructor(private readonly db: DbService) {}

  private mask(value: string): string {
    if (!value) return '';
    return value.length <= 6 ? '••••' : `${value.slice(0, 3)}••••${value.slice(-2)}`;
  }

  private toView(row: ConnectionRow): ConnectionView {
    const hints: Record<string, string> = {};
    if (row.secrets_enc) {
      try {
        const secrets = JSON.parse(openSecret(row.secrets_enc)) as Record<string, string>;
        for (const [k, v] of Object.entries(secrets)) {
          if (v) hints[k] = this.mask(v);
        }
      } catch {
        hints.error = 'unreadable';
      }
    }
    const { secrets_enc: _s, org_id: _o, ...rest } = row;
    return { ...rest, secretHints: hints };
  }

  async list(user: AuthUser): Promise<ConnectionView[]> {
    const rows = await this.db.query<ConnectionRow>(
      `SELECT * FROM connections WHERE org_id IS NOT DISTINCT FROM $1 OR org_id IS NULL
       ORDER BY kind, created_at`,
      [user.orgId ?? null],
    );
    return rows.rows.map((r) => this.toView(r));
  }

  async create(
    user: AuthUser,
    input: { kind: ConnectionKind; name: string; config: Record<string, unknown>; secrets?: Record<string, string> },
  ): Promise<ConnectionView> {
    if (!['iflow', 'iflow-write', 's4hana', 'btp'].includes(input.kind)) {
      validationError('unknown connection kind');
    }
    const secrets = this.pickSecrets(input.kind, input.secrets ?? {});
    const row = await this.db.query<ConnectionRow>(
      `INSERT INTO connections(org_id, kind, name, config, secrets_enc, active)
       VALUES($1, $2, $3, $4::jsonb, $5, true) RETURNING *`,
      [
        user.orgId ?? null,
        input.kind,
        input.name,
        JSON.stringify(input.config ?? {}),
        Object.keys(secrets).length ? sealSecret(JSON.stringify(secrets)) : null,
      ],
    );
    return this.toView(row.rows[0]);
  }

  async update(
    user: AuthUser,
    id: string,
    patch: { name?: string; config?: Record<string, unknown>; secrets?: Record<string, string>; active?: boolean },
  ): Promise<ConnectionView> {
    const existing = await this.byId(user, id);
    if (!existing) {
      validationError('connection not found');
    }

    // Merge secrets: blank values keep the stored secret (so the UI can show hints).
    let sealed = existing!.secrets_enc;
    if (patch.secrets && Object.keys(patch.secrets).length) {
      const current = existing!.secrets_enc
        ? (JSON.parse(openSecret(existing!.secrets_enc)) as Record<string, string>)
        : {};
      const incoming = this.pickSecrets(existing!.kind, patch.secrets);
      const merged = { ...current };
      for (const [k, v] of Object.entries(incoming)) {
        if (v) merged[k] = v;
      }
      sealed = sealSecret(JSON.stringify(merged));
    }

    const row = await this.db.query<ConnectionRow>(
      `UPDATE connections SET
         name = COALESCE($2, name),
         config = COALESCE($3::jsonb, config),
         secrets_enc = $4,
         active = COALESCE($5, active),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, patch.name ?? null, patch.config ? JSON.stringify(patch.config) : null, sealed, patch.active ?? null],
    );
    return this.toView(row.rows[0]);
  }

  async remove(user: AuthUser, id: string) {
    await this.db.query('DELETE FROM connections WHERE id = $1', [id]);
    return { removed: true, id };
  }

  private pickSecrets(kind: ConnectionKind, input: Record<string, string>): Record<string, string> {
    const allowed = SECRET_FIELDS[kind];
    const out: Record<string, string> = {};
    for (const f of allowed) {
      if (input[f]) out[f] = input[f];
    }
    return out;
  }

  private async byId(user: AuthUser, id: string): Promise<ConnectionRow | null> {
    const rows = await this.db.query<ConnectionRow>('SELECT * FROM connections WHERE id = $1', [id]);
    return rows.rows[0] ?? null;
  }

  /** Active connection of a kind, with secrets decrypted — for internal callers. */
  async resolveActive(kind: ConnectionKind, orgId?: string | null): Promise<ResolvedConnection | null> {
    try {
      const rows = await this.db.query<ConnectionRow>(
        `SELECT * FROM connections WHERE kind = $1 AND active = true
           AND (org_id IS NOT DISTINCT FROM $2 OR org_id IS NULL)
         ORDER BY (org_id IS NOT NULL) DESC, updated_at DESC LIMIT 1`,
        [kind, orgId ?? null],
      );
      let row = rows.rows[0];
      if (!row) {
        // Internal callers often have no tenant context. In a single-tenant
        // deployment the one active connection is unambiguous; with several
        // orgs configured we stay conservative and serve none.
        const any = await this.db.query<ConnectionRow>(
          'SELECT * FROM connections WHERE kind = $1 AND active = true LIMIT 2',
          [kind],
        );
        if (any.rows.length !== 1) return null;
        row = any.rows[0];
      }
      const secrets = row.secrets_enc ? (JSON.parse(openSecret(row.secrets_enc)) as Record<string, string>) : {};
      return { id: row.id, name: row.name, kind: row.kind, ...row.config, ...secrets };
    } catch (error) {
      this.logger.warn(`resolveActive(${kind}) failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return null;
    }
  }

  /** Live probe per system type; records status + message on the row. */
  async test(user: AuthUser, id: string): Promise<{ ok: boolean; message: string }> {
    const row = await this.byId(user, id);
    if (!row) {
      validationError('connection not found');
    }
    const secrets = row!.secrets_enc ? (JSON.parse(openSecret(row!.secrets_enc)) as Record<string, string>) : {};
    const cfg = { ...row!.config, ...secrets } as Record<string, string>;

    let result: { ok: boolean; message: string };
    try {
      result =
        row!.kind === 'btp'
          ? await this.testBtp(cfg)
          : row!.kind === 's4hana'
            ? await this.testS4(cfg)
            : row!.kind === 'iflow-write'
              ? // A write endpoint must not be probed with a real posting; just
                // confirm the URL is reachable and the credentials are accepted.
                await this.testWriteReachable(cfg)
              : await this.testIflow(cfg);
    } catch (error) {
      result = { ok: false, message: error instanceof Error ? error.message : 'connection failed' };
    }

    await this.db.query(
      'UPDATE connections SET status = $2, last_message = $3, last_tested_at = NOW() WHERE id = $1',
      [id, result.ok ? 'ok' : 'error', result.message],
    );
    return result;
  }

  private authHeaders(cfg: Record<string, string>): Record<string, string> {
    const mode = (cfg.auth || '').toLowerCase();
    if (mode === 'basic' || (!mode && cfg.username)) {
      return { Authorization: `Basic ${Buffer.from(`${cfg.username || ''}:${cfg.password || ''}`).toString('base64')}` };
    }
    if (mode === 'apikey' || (!mode && cfg.apiKey)) {
      return { [cfg.apiKeyHeader || 'APIKey']: cfg.apiKey || '' };
    }
    return {};
  }

  /**
   * iFlow probe — delegates to SapIflowClient so the test uses exactly the same
   * request/parse path as real queries (XML payloads, fixed endpoints, OAuth2).
   */
  private async testIflow(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    if (!cfg.url) {
      return { ok: false, message: 'endpoint URL is required' };
    }
    const probe = await this.iflow.testConnection(
      cfg.probeService || '/sap/opu/odata/sap/API_PRODUCT_SRV',
      cfg.probeEntitySet || 'A_Product',
      cfg as unknown as IflowOverride,
    );
    return { ok: probe.ok, message: probe.message };
  }

  /** Write endpoint: confirm reachability + auth without posting a document. */
  private async testWriteReachable(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    if (!cfg.url) {
      return { ok: false, message: 'endpoint URL is required' };
    }
    const res = await fetch(cfg.url, { method: 'OPTIONS', headers: await this.writeAuthHeaders(cfg) }).catch(
      () => null,
    );
    if (!res) {
      return { ok: false, message: 'endpoint unreachable' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: `credentials rejected (${res.status})` };
    }
    return { ok: true, message: `Write endpoint reachable (HTTP ${res.status}) — no document was posted` };
  }

  private async writeAuthHeaders(cfg: Record<string, string>): Promise<Record<string, string>> {
    if ((cfg.auth || '').toLowerCase() === 'oauth2' || cfg.tokenUrl) {
      return { Authorization: `Bearer ${await this.oauthToken(cfg)}` };
    }
    return this.authHeaders(cfg);
  }

  /** S/4HANA or Business Accelerator Hub: direct OData $top=1 probe. */
  private async testS4(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    if (!cfg.baseUrl) {
      return { ok: false, message: 'base URL is required' };
    }
    const service = cfg.probeService || '/sap/opu/odata/sap/API_PRODUCT_SRV';
    const entitySet = cfg.probeEntitySet || 'A_Product';
    const url = new URL(`${cfg.baseUrl.replace(/\/$/, '')}${service}/${entitySet}`);
    url.searchParams.set('$format', 'json');
    url.searchParams.set('$top', '1');
    const res = await fetch(url, { headers: { Accept: 'application/json', ...this.authHeaders(cfg) } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const hint =
        res.status === 401 || res.status === 403
          ? ' — check the API key / credentials'
          : res.status === 404
            ? ' — check the service path and entity set'
            : '';
      return { ok: false, message: `SAP returned ${res.status}${hint}${body ? ` (${body.slice(0, 90)})` : ''}` };
    }
    return { ok: true, message: `Reachable — ${entitySet} responded on ${service}` };
  }

  /** BTP tenant: validate by fetching an XSUAA client-credentials token. */
  private async testBtp(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
    if (!cfg.tokenUrl || !cfg.clientId) {
      return { ok: false, message: 'token URL and client id are required' };
    }
    const token = await this.oauthToken({ ...cfg, tokenUrl: cfg.tokenUrl });
    const where = [cfg.subaccount, cfg.region].filter(Boolean).join(' · ');
    return { ok: Boolean(token), message: `Authenticated with XSUAA${where ? ` (${where})` : ''} — token acquired` };
  }

  private async oauthToken(cfg: Record<string, string>): Promise<string> {
    const tokenUrl = cfg.tokenUrl;
    if (!tokenUrl) {
      throw new Error('token URL is required for OAuth2');
    }
    const basic = Buffer.from(`${cfg.clientId || ''}:${cfg.clientSecret || ''}`).toString('base64');
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`token request failed (${res.status})${body ? ` — ${body.slice(0, 100)}` : ''}`);
    }
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) {
      throw new Error('token response had no access_token');
    }
    return body.access_token;
  }
}
