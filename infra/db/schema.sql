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

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (prefix) WHERE revoked = false;

ALTER TABLE warehouse_policies ADD COLUMN IF NOT EXISTS write_window_start INT;
ALTER TABLE warehouse_policies ADD COLUMN IF NOT EXISTS write_window_end INT;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE TABLE IF NOT EXISTS eval_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  question TEXT NOT NULL,
  expect_substring TEXT,
  source TEXT NOT NULL DEFAULT 'feedback',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  api_key_enc TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_models_user ON user_models (user_id) WHERE active = true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS autopilot BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_models ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'chat';

-- Phase T (spec alignment): multi-window rate limits, per-tool cache policies, audit enrichment.
ALTER TABLE user_quota ADD COLUMN IF NOT EXISTS daily_token_limit INT;
ALTER TABLE user_quota ADD COLUMN IF NOT EXISTS weekly_token_limit INT;
ALTER TABLE user_quota ADD COLUMN IF NOT EXISTS overage_policy TEXT NOT NULL DEFAULT 'block';

CREATE TABLE IF NOT EXISTS cache_policies (
  tool_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ttl_seconds INT,
  key_strategy TEXT NOT NULL DEFAULT 'global',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'chat';
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS tool_ms INT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS llm_ms INT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS payload_bytes INT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS error_detail TEXT;
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS tools_detail JSONB;

-- Phase U (spec App #1): metadata-driven Business Object registry. A functional
-- consultant registers an SAP OData object here and it becomes queryable with no
-- code change, served through the generic iFlow OData passthrough.
CREATE TABLE IF NOT EXISTS business_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  object_code TEXT NOT NULL,
  object_name TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  destination_name TEXT,
  odata_service_path TEXT NOT NULL,
  entity_set TEXT NOT NULL,
  default_filters TEXT,
  select_fields TEXT,
  date_field TEXT,
  api_version TEXT NOT NULL DEFAULT 'v2',
  top_limit INT NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  modified_by TEXT,
  modified_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_objects_org ON business_objects (org_id) WHERE is_active = true;

-- Seed the five spec business objects as global templates (org_id NULL).
INSERT INTO business_objects (object_code, object_name, keywords, odata_service_path, entity_set, default_filters, select_fields, date_field, api_version, top_limit)
SELECT * FROM (VALUES
  ('SALES', 'Sales Orders',
   'orders, sales order, SO, sell, customer order',
   '/sap/opu/odata/sap/API_SALES_ORDER_SRV', 'A_SalesOrder',
   'Plant eq ''{warehouseId}''', 'SalesOrder,SoldToPartyName,Plant,OverallStatus,RequestedDeliveryDate,TotalNetAmount', 'RequestedDeliveryDate', 'v2', 50),
  ('DELIVERY', 'Outbound Deliveries',
   'delivery, deliveries, deliver, outbound, to be delivered, shipment',
   '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV', 'A_OutboundDelivery',
   'Warehouse eq ''{warehouseId}''', 'DeliveryDocument,Warehouse,Route,Carrier,GoodsMovementStatus,PlannedGoodsIssueDate', 'PlannedGoodsIssueDate', 'v2', 50),
  ('SHIPPING', 'Shipping',
   'shipping, ship, shipped, carrier, freight, route',
   '/sap/opu/odata/sap/API_OUTBOUND_DELIVERY_SRV', 'A_OutboundDelivery',
   'Warehouse eq ''{warehouseId}''', 'DeliveryDocument,Warehouse,Route,Carrier,ShippingStatus,PlannedGoodsIssueDate', 'PlannedGoodsIssueDate', 'v2', 50),
  ('GOODS_MOVEMENT', 'Goods Movements',
   'goods movement, movement, material document, posting, 101, 601, receipt, issue',
   '/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV', 'A_MaterialDocumentItem',
   'Plant eq ''{warehouseId}''', 'MaterialDocument,GoodsMovementType,Material,Plant,QuantityInEntryUnit,PostingDate', 'PostingDate', 'v2', 100),
  ('PURCHASING', 'Purchase Orders',
   'purchasing, purchase order, PO, procurement, buy, supplier order',
   '/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV', 'A_PurchaseOrderItem',
   'Plant eq ''{warehouseId}''', 'PurchaseOrder,Material,Plant,OrderQuantity,DeliveryStatus,Supplier,DeliveryDate', 'DeliveryDate', 'v2', 50)
) AS seed(object_code, object_name, keywords, odata_service_path, entity_set, default_filters, select_fields, date_field, api_version, top_limit)
WHERE NOT EXISTS (SELECT 1 FROM business_objects b WHERE b.object_code = seed.object_code AND b.org_id IS NULL);

-- Phase V: contextualization rules (spec Component 5) — how to summarize each
-- object into status counts, dimension breakdowns, and date buckets.
ALTER TABLE business_objects ADD COLUMN IF NOT EXISTS status_field TEXT;
ALTER TABLE business_objects ADD COLUMN IF NOT EXISTS status_labels JSONB;
ALTER TABLE business_objects ADD COLUMN IF NOT EXISTS group_by TEXT;

UPDATE business_objects SET status_field = 'OverallStatus',
  status_labels = '{"A":"Not started","B":"In process","C":"Complete"}'::jsonb, group_by = ''
  WHERE object_code = 'SALES' AND org_id IS NULL AND status_field IS NULL;
UPDATE business_objects SET status_field = 'GoodsMovementStatus',
  status_labels = '{"A":"Not shipped","B":"Partially shipped","C":"Goods issued"}'::jsonb, group_by = 'Route,Carrier'
  WHERE object_code = 'DELIVERY' AND org_id IS NULL AND status_field IS NULL;
UPDATE business_objects SET status_field = 'ShippingStatus',
  status_labels = '{"pending":"Pending","shipped":"Shipped"}'::jsonb, group_by = 'Carrier,Route'
  WHERE object_code = 'SHIPPING' AND org_id IS NULL AND status_field IS NULL;
UPDATE business_objects SET status_field = 'GoodsMovementType',
  status_labels = '{"101":"Goods receipt (101)","601":"Goods issue - delivery (601)","201":"Goods issue - cost center (201)","261":"Goods issue - order (261)"}'::jsonb, group_by = 'GoodsMovementType,Material'
  WHERE object_code = 'GOODS_MOVEMENT' AND org_id IS NULL AND status_field IS NULL;
UPDATE business_objects SET status_field = 'DeliveryStatus',
  status_labels = '{"open":"Open","delivered":"Delivered"}'::jsonb, group_by = 'Supplier'
  WHERE object_code = 'PURCHASING' AND org_id IS NULL AND status_field IS NULL;
