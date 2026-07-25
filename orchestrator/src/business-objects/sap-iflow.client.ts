import { Logger } from '@nestjs/common';

/**
 * Connector to the customer's SAP landscape (Phase W, extended in Phase AD).
 * Resolution order: an active Connection Center row (iFlow, else direct
 * S/4HANA/BAH) → SAP_IFLOW_URL env → the local simulator. So going live is a UI
 * action, and live data always wins over mock. Auth is pluggable
 * (basic / apikey / oauth2 / none).
 */

export interface ODataQuery {
  service: string;
  entitySet: string;
  filter?: string;
  select?: string;
  top?: number;
  objectCode?: string;
  warehouseId?: string;
  todayOnly?: boolean;
}

export interface ODataResult {
  records: Array<Record<string, unknown>>;
  dataSource: string;
  mode: 'iflow' | 's4hana' | 'simulator';
}

type AuthMode = 'basic' | 'apikey' | 'oauth2' | 'none';

/** Runtime override from the Connection Center; wins over env vars. */
export interface IflowOverride {
  url?: string;
  method?: string;
  auth?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  /** Direct S/4HANA / BAH base URL (used when no iFlow is configured). */
  baseUrl?: string;
}

export class SapIflowClient {
  private readonly logger = new Logger(SapIflowClient.name);

  private readonly envUrl = process.env.SAP_IFLOW_URL?.replace(/\/$/, '') || '';
  private readonly envMethod = (process.env.SAP_IFLOW_METHOD || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';
  private readonly simulatorBase = (process.env.IFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  /** Effective iFlow endpoint for this call (connection row first, then env). */
  private urlOf(ov?: IflowOverride): string {
    return (ov?.url || this.envUrl || '').replace(/\/$/, '');
  }

  private methodOf(ov?: IflowOverride): 'GET' | 'POST' {
    const m = (ov?.method || '').toUpperCase();
    if (m === 'GET' || m === 'POST') return m;
    return this.envMethod;
  }

  isLive(ov?: IflowOverride): boolean {
    return Boolean(this.urlOf(ov) || ov?.baseUrl);
  }

  private authMode(ov?: IflowOverride): AuthMode {
    if (ov && (ov.url || ov.baseUrl)) {
      const explicit = (ov.auth || '').toLowerCase() as AuthMode;
      if (explicit) return explicit;
      if (ov.username) return 'basic';
      if (ov.apiKey) return 'apikey';
      if (ov.tokenUrl) return 'oauth2';
      return 'none';
    }
    const explicit = (process.env.SAP_IFLOW_AUTH || '').toLowerCase() as AuthMode;
    if (explicit) return explicit;
    if (process.env.SAP_IFLOW_USER) return 'basic';
    if (process.env.SAP_IFLOW_APIKEY) return 'apikey';
    if (process.env.SAP_IFLOW_TOKEN_URL) return 'oauth2';
    return 'none';
  }

  private async authHeaders(ov?: IflowOverride): Promise<Record<string, string>> {
    const useOv = Boolean(ov && (ov.url || ov.baseUrl));
    switch (this.authMode(ov)) {
      case 'basic': {
        const user = useOv ? ov!.username || '' : process.env.SAP_IFLOW_USER || '';
        const pass = useOv ? ov!.password || '' : process.env.SAP_IFLOW_PASSWORD || '';
        return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
      }
      case 'apikey': {
        const header = (useOv ? ov!.apiKeyHeader : process.env.SAP_IFLOW_APIKEY_HEADER) || 'APIKey';
        const value = useOv ? ov!.apiKey || '' : process.env.SAP_IFLOW_APIKEY || '';
        return { [header]: value };
      }
      case 'oauth2':
        return { Authorization: `Bearer ${await this.oauthToken(ov)}` };
      default:
        return {};
    }
  }

  private async oauthToken(ov?: IflowOverride): Promise<string> {
    const useOv = Boolean(ov && (ov.url || ov.baseUrl));
    const tokenUrl = (useOv ? ov!.tokenUrl : process.env.SAP_IFLOW_TOKEN_URL) || '';
    const clientId = (useOv ? ov!.clientId : process.env.SAP_IFLOW_CLIENT_ID) || '';
    const clientSecret = (useOv ? ov!.clientSecret : process.env.SAP_IFLOW_CLIENT_SECRET) || '';
    if (!tokenUrl) {
      throw new Error('OAuth2 selected but no token URL is configured');
    }
    const cached = this.tokenCache.get(tokenUrl + clientId);
    if (cached && Date.now() < cached.expiresAt - 30_000) {
      return cached.token;
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new Error(`OAuth2 token request failed (${res.status})`);
    }
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    this.tokenCache.set(tokenUrl + clientId, {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    });
    return body.access_token;
  }

  /** Accepts {records}, raw OData v2 {d:{results}}, v4 {value}, or a bare array. */
  private normalize(body: unknown): { records: Array<Record<string, unknown>>; dataSource?: string } {
    if (Array.isArray(body)) {
      return { records: body as Array<Record<string, unknown>> };
    }
    const obj = (body ?? {}) as Record<string, unknown>;
    if (Array.isArray(obj.records)) {
      return { records: obj.records as Array<Record<string, unknown>>, dataSource: obj.dataSource as string };
    }
    const d = obj.d as { results?: unknown } | undefined;
    if (d && Array.isArray(d.results)) {
      return { records: d.results as Array<Record<string, unknown>>, dataSource: 'sap' };
    }
    if (Array.isArray(obj.value)) {
      return { records: obj.value as Array<Record<string, unknown>>, dataSource: 'sap' };
    }
    return { records: [] };
  }

  async query(q: ODataQuery, ov?: IflowOverride): Promise<ODataResult> {
    const iflowUrl = this.urlOf(ov);

    if (iflowUrl) {
      const headers: Record<string, string> = { Accept: 'application/json', ...(await this.authHeaders(ov)) };
      const res =
        this.methodOf(ov) === 'GET'
          ? await fetch(this.buildGetUrl(iflowUrl, q), { headers })
          : await fetch(iflowUrl, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify(q),
            });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`iFlow call failed ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`SAP iFlow returned ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
      }
      const norm = this.normalize(await res.json());
      return { records: norm.records, dataSource: norm.dataSource ?? 'sap-iflow', mode: 'iflow' };
    }

    // Direct S/4HANA / Business Accelerator Hub OData (no iFlow registered).
    if (ov?.baseUrl) {
      const url = new URL(`${ov.baseUrl.replace(/\/$/, '')}${q.service}/${q.entitySet}`);
      url.searchParams.set('$format', 'json');
      if (q.filter) url.searchParams.set('$filter', q.filter);
      if (q.select) url.searchParams.set('$select', q.select);
      url.searchParams.set('$top', String(q.top ?? 50));
      const res = await fetch(url, { headers: { Accept: 'application/json', ...(await this.authHeaders(ov)) } });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`SAP returned ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
      }
      const norm = this.normalize(await res.json());
      return { records: norm.records, dataSource: 'sap-s4hana', mode: 's4hana' };
    }

    // Fallback: local simulator generic passthrough.
    const res = await fetch(this.buildGetUrl(`${this.simulatorBase}/iflow/odata`, q));
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message || `business object query failed (${res.status})`);
    }
    const norm = this.normalize(await res.json());
    return { records: norm.records, dataSource: norm.dataSource ?? 'simulator', mode: 'simulator' };
  }

  private buildGetUrl(base: string, q: ODataQuery): URL {
    const url = new URL(base);
    url.searchParams.set('service', q.service);
    url.searchParams.set('entitySet', q.entitySet);
    if (q.filter) url.searchParams.set('filter', q.filter);
    if (q.select) url.searchParams.set('select', q.select);
    if (q.top) url.searchParams.set('top', String(q.top));
    return url;
  }

  /** Test-connection probe: a top=1 query validates reachability + auth. */
  async testConnection(
    service: string,
    entitySet: string,
    ov?: IflowOverride,
  ): Promise<{ ok: boolean; mode: string; message: string }> {
    try {
      if (this.isLive(ov)) {
        const result = await this.query({ service, entitySet, top: 1 }, ov);
        const via = result.mode === 's4hana' ? 'S/4HANA' : 'iFlow';
        return {
          ok: true,
          mode: result.mode,
          message: `Reachable via ${via} (${this.authMode(ov)} auth) — ${entitySet} returned ${result.records.length} row(s)`,
        };
      }
      const url = new URL(`${this.simulatorBase}/iflow/odata/metadata`);
      url.searchParams.set('service', service);
      url.searchParams.set('entitySet', entitySet);
      const res = await fetch(url);
      const body = (await res.json()) as { ok?: boolean; mode?: string };
      return {
        ok: Boolean(body.ok),
        mode: body.mode ?? 'simulator',
        message: body.ok
          ? `Reachable (${body.mode}) — ${entitySet} on ${service}`
          : `Not reachable (${body.mode ?? 'error'}) — check the service path and entity set`,
      };
    } catch (error) {
      return { ok: false, mode: 'error', message: error instanceof Error ? error.message : 'connection failed' };
    }
  }
}
