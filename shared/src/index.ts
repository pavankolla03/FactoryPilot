export type UserRole = 'admin' | 'viewer';
export type ScopeAccessLevel = 'read' | 'write';
export type ConversationRole = 'user' | 'assistant' | 'tool';
export type CacheStatus = 'hit' | 'miss' | 'n/a';
export type SessionStatus = 'success' | 'error' | 'blocked_scope' | 'blocked_quota';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface UserScope {
  id: string;
  user_id: string;
  warehouse_id: string;
  access_level: ScopeAccessLevel;
}

export interface UserQuota {
  user_id: string;
  monthly_token_limit: number;
  period_start: string;
}

export interface TokenUsageRecord {
  id: string;
  user_id: string;
  occurred_at: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model_used: string;
  is_estimated: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: ConversationRole;
  content: string;
  tool_calls_json?: unknown;
  created_at: string;
}

export interface SessionLogEntry {
  id: string;
  user_id: string;
  conversation_id: string | null;
  query_text: string;
  tools_invoked_json: unknown;
  cache_status: CacheStatus;
  tokens_used: number;
  status: SessionStatus;
  latency_ms: number;
  created_at: string;
}

export interface PendingAction {
  actionId: string;
  tool: string;
  params: Record<string, unknown>;
  humanSummary: string;
  requestedBy?: string;
  requestedById?: string;
  makerChecker?: boolean;
  anomaly?: { reason: string };
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId?: string;
  text: string;
  source: 'cache' | 'live';
  grounded?: boolean;
  pendingAction?: PendingAction;
}

export interface ApiError {
  error: {
    code:
      | 'SCOPE_DENIED'
      | 'QUOTA_EXCEEDED'
      | 'ACTION_EXPIRED'
      | 'INSUFFICIENT_STOCK'
      | 'VALIDATION_ERROR';
    message: string;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: unknown;
}
