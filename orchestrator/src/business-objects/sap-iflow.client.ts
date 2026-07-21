import { Logger } from '@nestjs/common';

/**
 * Connector to the SAP Integration Suite iFlow that fronts Business Accelerator
 * Hub / S/4HANA OData (Phase W). When SAP_IFLOW_URL is set the orchestrator calls
 * the real iFlow over HTTPS; otherwise it falls back to the local simulator's
 * generic /iflow/odata passthrough. Auth is pluggable (basic / apikey / oauth2 /
 * none) so wiring a real tenant is configuration, not code.
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
  mode: 'iflow' | 'simulator';
}

type AuthMode = 'basic' | 'apikey' | 'oauth2' | 'none';

export class SapIflowClient {
  private readonly logger = new Logger(SapIflowClient.name);

  private readonly iflowUrl = process.env.SAP_IFLOW_URL?.replace(/\/$/, '') || '';
  private readonly method = (process.env.SAP_IFLOW_METHOD || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';
  // Fallback simulator passthrough (used when no real iFlow is configured).
  private readonly simulatorBase = (process.env.IFLOW_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

  private tokenCache: { token: string; expiresAt: number } | null = null;

  /** Real iFlow configured? Otherwise the local simulator answers. */
  isLive(): boolean {
    return Boolean(this.iflowUrl);
  }

  private authMode(): AuthMode {
    const explicit = (process.env.SAP_IFLOW_AUTH || '').toLowerCase() as AuthMode;
    if (explicit) {
      return explicit;
    }
    if (process.env.SAP_IFLOW_USER) {
      return 'basic';
    }
    if (process.env.SAP_IFLOW_APIKEY) {
      return 'apikey';
    }
    if (process.env.SAP_IFLOW_TOKEN_URL) {
      return 'oauth2';
    }
    return 'none';
  }

  private async authHeaders(): Promise<Record<string, string>> {
    switch (this.authMode()) {
      case 'basic': {
        const creds = Buffer.from(
          `${process.env.SAP_IFLOW_USER || ''}:${process.env.SAP_IFLOW_PASSWORD || ''}`,
        ).toString('base64');
        return { Authorization: `Basic ${creds}` };
      }
      case 'apikey': {
        const header = process.env.SAP_IFLOW_APIKEY_HEADER || 'APIKey';
        return { [header]: process.env.SAP_IFLOW_APIKEY || '' };
      }
      case 'oauth2': {
        const token = await this.oauthToken();
        return { Authorization: `Bearer ${token}` };
      }
      default:
        return {};
    }
  }

  private async oauthToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 30_000) {
      return this.tokenCache.token;
    }
    const tokenUrl = process.env.SAP_IFLOW_TOKEN_URL as string;
    const basic = Buffer.from(
      `${process.env.SAP_IFLOW_CLIENT_ID || ''}:${process.env.SAP_IFLOW_CLIENT_SECRET || ''}`,
    ).toString('base64');
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new Error(`iFlow OAuth2 token request failed (${res.status})`);
    }
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    this.tokenCache = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  /** Normalize the iFlow/simulator response — accepts {records}, raw OData, or a bare array. */
  private normalize(body: unknown): { records: Array<Record<string, unknown>>; dataSource?: string } {
    if (Array.isArray(body)) {
      return { records: body as Array<Record<string, unknown>> };
    }
    const obj = (body ?? {}) as Record<string, unknown>;
    if (Array.isArray(obj.records)) {
      return { records: obj.records as Array<Record<string, unknown>>, dataSource: obj.dataSource as string };
    }
    // Raw OData v2 { d: { results: [...] } } or v4 { value: [...] }.
    const d = obj.d as { results?: unknown } | undefined;
    if (d && Array.isArray(d.results)) {
      return { records: d.results as Array<Record<string, unknown>>, dataSource: 'sap' };
    }
    if (Array.isArray(obj.value)) {
      return { records: obj.value as Array<Record<string, unknown>>, dataSource: 'sap' };
    }
    return { records: [] };
  }

  async query(q: ODataQuery): Promise<ODataResult> {
    if (this.isLive()) {
      const headers: Record<string, string> = { Accept: 'application/json', ...(await this.authHeaders()) };
      let res: Response;
      if (this.method === 'GET') {
        const url = new URL(this.iflowUrl);
        url.searchParams.set('service', q.service);
        url.searchParams.set('entitySet', q.entitySet);
        if (q.filter) url.searchParams.set('filter', q.filter);
        if (q.select) url.searchParams.set('select', q.select);
        if (q.top) url.searchParams.set('top', String(q.top));
        res = await fetch(url, { headers });
      } else {
        res = await fetch(this.iflowUrl, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(q),
        });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`iFlow call failed ${res.status}: ${text.slice(0, 200)}`);
        throw new Error(`SAP iFlow returned ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
      }
      const norm = this.normalize(await res.json());
      return { records: norm.records, dataSource: norm.dataSource ?? 'sap-iflow', mode: 'iflow' };
    }

    // Fallback: local simulator generic passthrough (mock / SAP_API_KEY sandbox).
    const url = new URL(`${this.simulatorBase}/iflow/odata`);
    url.searchParams.set('service', q.service);
    url.searchParams.set('entitySet', q.entitySet);
    if (q.filter) url.searchParams.set('filter', q.filter);
    if (q.select) url.searchParams.set('select', q.select);
    if (q.top) url.searchParams.set('top', String(q.top));
    const res = await fetch(url);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message || `business object query failed (${res.status})`);
    }
    const norm = this.normalize(await res.json());
    return { records: norm.records, dataSource: norm.dataSource ?? 'simulator', mode: 'simulator' };
  }

  /** Test-connection probe: a top=1 query is enough to validate reachability + auth. */
  async testConnection(service: string, entitySet: string): Promise<{ ok: boolean; mode: string; message: string }> {
    try {
      if (this.isLive()) {
        const result = await this.query({ service, entitySet, top: 1 });
        return {
          ok: true,
          mode: 'iflow',
          message: `Reachable via iFlow (${this.authMode()} auth) — ${entitySet} returned ${result.records.length} row(s)`,
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
