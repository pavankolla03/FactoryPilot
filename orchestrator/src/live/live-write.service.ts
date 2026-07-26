import { Injectable, Logger } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';

/** Write tools that can be posted to SAP once a write iFlow is registered. */
const WRITE_TOOLS = new Set(['moveStock', 'draftPurchaseRequisition', 'receivePurchaseOrder', 'adjustStock']);

export interface LiveWriteResult {
  posted: true;
  /** SAP document the write created (material document, PR number, …). */
  documentNumber: string | null;
  dataSource: string;
  raw: Record<string, unknown>;
}

/**
 * Write-back (Phase AH): posts an approved write to the customer's write iFlow
 * when one is registered, so the effect lands in SAP rather than the local
 * ledger. Governance is unchanged — this runs only after the existing approval,
 * anomaly and maker-checker gates have passed.
 */
@Injectable()
export class LiveWriteService {
  private readonly logger = new Logger(LiveWriteService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly connections: ConnectionsService) {}

  canPost(tool: string): boolean {
    return WRITE_TOOLS.has(tool);
  }

  /** A registered, active connection of kind 'iflow-write'. */
  private async writeConnection(orgId?: string | null): Promise<Record<string, string> | null> {
    const conn = await this.connections.resolveActive('iflow-write', orgId);
    return conn?.url ? (conn as unknown as Record<string, string>) : null;
  }

  private async authHeaders(cfg: Record<string, string>): Promise<Record<string, string>> {
    const mode = (cfg.auth || '').toLowerCase();
    if (mode === 'basic' || (!mode && cfg.username)) {
      return {
        Authorization: `Basic ${Buffer.from(`${cfg.username || ''}:${cfg.password || ''}`).toString('base64')}`,
      };
    }
    if (mode === 'apikey' || (!mode && cfg.apiKey)) {
      return { [cfg.apiKeyHeader || 'APIKey']: cfg.apiKey || '' };
    }
    if (mode === 'oauth2' || cfg.tokenUrl) {
      if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 30_000) {
        return { Authorization: `Bearer ${this.tokenCache.token}` };
      }
      const basic = Buffer.from(`${cfg.clientId || ''}:${cfg.clientSecret || ''}`).toString('base64');
      const res = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
      if (!res.ok) {
        throw new Error(`write iFlow OAuth2 token request failed (${res.status})`);
      }
      const body = (await res.json()) as { access_token: string; expires_in?: number };
      this.tokenCache = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
      return { Authorization: `Bearer ${body.access_token}` };
    }
    return {};
  }

  /** Pull the created document number out of whatever the iFlow returned. */
  private documentOf(body: unknown): string | null {
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
    const keys = [
      'MaterialDocument',
      'PurchaseRequisition',
      'PurchaseOrder',
      'documentNumber',
      'DocumentNumber',
    ];
    for (const k of keys) {
      const m = new RegExp(`["<]${k}["> ]*[:>]\\s*"?([A-Za-z0-9-]+)`).exec(text);
      if (m?.[1]) return m[1];
    }
    return null;
  }

  /**
   * Post an approved write. Returns null when no write iFlow is registered, so
   * the caller falls back to the existing MCP/ledger path unchanged.
   */
  async post(
    tool: string,
    params: Record<string, unknown>,
    orgId?: string | null,
  ): Promise<LiveWriteResult | null> {
    if (!this.canPost(tool)) return null;
    const cfg = await this.writeConnection(orgId);
    if (!cfg) return null;

    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...(await this.authHeaders(cfg)) };
    const res = await fetch(cfg.url, {
      method: (cfg.method || 'POST').toUpperCase(),
      headers,
      body: JSON.stringify({ operation: tool, ...params }),
    });

    const text = await res.text();
    if (!res.ok) {
      // Surface the failure — never silently fall back to the ledger, or an
      // operator would believe a write reached SAP when it did not.
      throw new Error(`SAP write iFlow returned ${res.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
    }

    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* XML or plain text response — keep the raw string */
    }
    const documentNumber = this.documentOf(parsed);
    this.logger.log(`live write ${tool} -> SAP document ${documentNumber ?? '(none returned)'}`);
    return {
      posted: true,
      documentNumber,
      dataSource: 'sap-iflow (live write)',
      raw: (typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : { response: text }),
    };
  }
}
