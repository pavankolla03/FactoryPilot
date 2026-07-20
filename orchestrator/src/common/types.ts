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
}
