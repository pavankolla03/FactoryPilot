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
  /** The URL actually requested, shown in the chat activity trail (Phase AQ). */
  endpoint?: string;
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
  /**
   * The iFlow exposes one fixed operation and ignores query params (common for
   * a first iFlow, e.g. /http/materialstockread). Send a bare GET.
   */
  fixedEndpoint?: boolean | string;
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

  /**
   * Parse an XML payload into records. Handles the shape SAP iFlow message
   * mapping emits (a wrapper element containing repeated row elements), which is
   * not Atom/OData XML. Picks the most-repeated element that has children as the
   * row, then reads its leaf fields.
   */
  private parseXmlRecords(xml: string): Array<Record<string, unknown>> {
    const body = xml.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const counts = new Map<string, number>();
    for (const m of body.matchAll(/<([A-Za-z_][\w.:-]*)\b[^>/]*>/g)) {
      counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
    }

    let rowTag = '';
    let best = 0;
    for (const [tag, count] of counts) {
      if (count <= best) continue;
      const probe = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(body);
      if (probe && /<[A-Za-z_]/.test(probe[1])) {
        rowTag = tag;
        best = count;
      }
    }
    if (!rowTag) {
      return [];
    }

    const decode = (v: string) =>
      v
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();

    const records: Array<Record<string, unknown>> = [];
    for (const rowMatch of body.matchAll(new RegExp(`<${rowTag}\\b[^>]*>([\\s\\S]*?)</${rowTag}>`, 'g'))) {
      const inner = rowMatch[1];
      const rec: Record<string, unknown> = {};
      for (const f of inner.matchAll(/<([A-Za-z_][\w.:-]*)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
        if (/<[A-Za-z_]/.test(f[2])) continue; // nested, not a leaf
        rec[f[1]] = decode(f[2]);
      }
      for (const f of inner.matchAll(/<([A-Za-z_][\w.:-]*)\b[^>]*\/>/g)) {
        if (!(f[1] in rec)) rec[f[1]] = '';
      }
      if (Object.keys(rec).length) records.push(rec);
    }
    return records;
  }

  /**
   * Fixed-endpoint iFlows ignore $filter/$top, so apply them here instead — the
   * caller still gets contract behaviour (and the LLM never sees 2,700 rows).
   * Supports the clauses the registry generates: `Field eq 'value'` (and
   * datetime literals) joined by `and`.
   */
  private applyClientSide(records: Array<Record<string, unknown>>, q: ODataQuery): Array<Record<string, unknown>> {
    let out = records;
    if (q.filter) {
      const clauses = q.filter.split(/\s+and\s+/i);
      out = out.filter((row) =>
        clauses.every((clause) => {
          const m = /^\s*([A-Za-z_][\w.]*)\s+eq\s+(.+?)\s*$/.exec(clause);
          if (!m) return true; // unsupported clause — don't exclude
          const [, field, rawValue] = m;
          const dt = /^datetime'([^']+)'$/i.exec(rawValue);
          const actual = String(row[field] ?? '');
          if (dt) return actual.slice(0, 10) === dt[1].slice(0, 10);
          const value =
            rawValue.startsWith("'") && rawValue.endsWith("'")
              ? rawValue.slice(1, -1).replace(/''/g, "'")
              : rawValue;
          return actual === value;
        }),
      );
    }
    if (q.top && out.length > q.top) {
      out = out.slice(0, q.top);
    }
    // Project $select too — a fixed endpoint returns every mapped field, which is
    // mostly empty noise and needlessly expensive for the model to read.
    if (q.select) {
      const keep = q.select.split(',').map((f) => f.trim()).filter(Boolean);
      if (keep.length) {
        out = out.map((row) => {
          const slim: Record<string, unknown> = {};
          for (const k of keep) {
            if (row[k] !== undefined && row[k] !== '') slim[k] = row[k];
          }
          return Object.keys(slim).length ? slim : row;
        });
      }
    }
    return out;
  }

  /** Reads a response as JSON, falling back to XML when the iFlow returns XML. */
  private async readBody(res: Response): Promise<{ records: Array<Record<string, unknown>>; dataSource?: string }> {
    const text = await res.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      return { records: this.parseXmlRecords(text), dataSource: 'sap-iflow-xml' };
    }
    try {
      return this.normalize(JSON.parse(text));
    } catch {
      return { records: [] };
    }
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
      const fixed = ov?.fixedEndpoint === true || ov?.fixedEndpoint === 'true';
      const res =
        this.methodOf(ov) === 'GET'
          ? await fetch(fixed ? iflowUrl : this.buildGetUrl(iflowUrl, q).toString(), { headers })
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
      const norm = await this.readBody(res);
      const records = fixed ? this.applyClientSide(norm.records, q) : norm.records;
      return { records, dataSource: norm.dataSource ?? 'sap-iflow', mode: 'iflow', endpoint: iflowUrl };
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
      const norm = await this.readBody(res);
      return { records: norm.records, dataSource: 'sap-s4hana', mode: 's4hana', endpoint: url.toString() };
    }

    // Fallback: local simulator generic passthrough.
    const res = await fetch(this.buildGetUrl(`${this.simulatorBase}/iflow/odata`, q));
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message || `business object query failed (${res.status})`);
    }
    const norm = this.normalize(await res.json());
    return {
      records: norm.records,
      dataSource: norm.dataSource ?? 'simulator',
      mode: 'simulator',
      endpoint: `${this.simulatorBase}/iflow/odata`,
    };
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
