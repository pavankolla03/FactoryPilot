CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'viewer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
    CREATE TYPE access_level AS ENUM ('read', 'write');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_role') THEN
    CREATE TYPE conversation_role AS ENUM ('user', 'assistant', 'tool');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cache_status') THEN
    CREATE TYPE cache_status AS ENUM ('hit', 'miss', 'n/a');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('success', 'error', 'blocked_scope', 'blocked_quota');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  access_level access_level NOT NULL,
  UNIQUE (user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS user_quota (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_token_limit INT NOT NULL DEFAULT 50000,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  model_used TEXT NOT NULL,
  is_estimated BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role conversation_role NOT NULL,
  content TEXT NOT NULL,
  tool_calls_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  tools_invoked_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cache_status cache_status NOT NULL,
  tokens_used INT NOT NULL DEFAULT 0,
  status session_status NOT NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  threshold INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_policies (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  auto_approve_max_qty INT,
  maker_checker BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS warehouse_policies (
  warehouse_id TEXT PRIMARY KEY,
  auto_approve_max_qty INT,
  maker_checker BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_alerts_active ON stock_alerts (active);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_scopes_user_id ON user_scopes (user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_time ON token_usage (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conv_msgs_conv_id ON conversation_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_time ON session_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_session_logs_status ON session_logs (status);

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report TEXT NOT NULL,
  warehouse_id TEXT,
  hour INT NOT NULL,
  day_of_week INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL DEFAULT 'replenishment',
  warehouse_id TEXT NOT NULL,
  threshold INT NOT NULL DEFAULT 50,
  autonomy TEXT NOT NULL DEFAULT 'propose',
  daily_budget_qty INT NOT NULL DEFAULT 200,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES agent_goals(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  goal_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID,
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs (user_id, started_at DESC);

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS outcome_checked_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episodic_scope ON episodic_memory (scope_key, created_at DESC);
