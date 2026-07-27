export interface WarehouseScope {
  warehouseId: string;
  accessLevel: 'read' | 'write';
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'viewer';
  scopes: WarehouseScope[];
  /** Tenant id (beta multi-tenancy). Nullable for legacy tokens. */
  orgId?: string | null;
}

export interface RequestWithUser {
  headers: {
    authorization?: string;
    [key: string]: unknown;
  };
  user: AuthUser;
}

export interface QuotaWindow {
  window: 'daily' | 'weekly' | 'monthly';
  used: number;
  limit: number;
}

export interface UsageSnapshot {
  used: number;
  limit: number;
  periodStart: string;
  /** Configured limit windows, tightest first (daily, weekly, monthly). */
  windows?: QuotaWindow[];
  /** 'block' rejects over-limit requests; 'warn' allows them but notifies. */
  overagePolicy?: 'block' | 'warn';
  /**
   * Estimated spend (Phase AT). Derived from list prices, never from provider
   * billing, so it is always presented as an estimate.
   */
  cost?: {
    monthlyUsd: number;
    dailyUsd: number;
    /** Tokens from models with no price entry — excluded from the totals above. */
    unpricedTokens: number;
    estimated: true;
  };
}
