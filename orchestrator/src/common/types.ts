export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'viewer';
  scopes: string[];
}

export interface RequestWithUser {
  headers: {
    authorization?: string;
    [key: string]: unknown;
  };
  user: AuthUser;
}

export interface UsageSnapshot {
  used: number;
  limit: number;
  periodStart: string;
}
