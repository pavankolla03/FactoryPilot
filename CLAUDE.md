# FactoryPilot — working context

AI agent platform for SAP Manufacturing/Warehousing: agentic chat ("Otto") +
autonomous agents over SAP data, with governance, cost control and audit.

**Read this file first. Then use `graphify query "<question>"` to locate code —
do not read whole files or grep broadly; the graph is far cheaper.**

## Stack / layout

Monorepo, npm workspaces. `orchestrator` (NestJS: auth, chat agent loop, agents,
LLM routing, cache, quota, realtime, admin) · `frontend` (React+Vite+Tailwind) ·
`mcp-servers/mcp-inventory` + `mcp-warehouse-ops` (MCP tools) ·
`integration-mocks/iflow-simulator` (mock SAP + live BAH layer) · `approuter` ·
`shared` · `infra` (schema.sql, docker-compose).

Flow: Browser → Approuter → Orchestrator → MCP (Streamable HTTP) → iFlow → SAP.
Postgres + Redis. Socket.IO on `/ws` (`chat:token|status|done`, `token_usage:*`).

## Local dev

```bash
cd infra && docker compose up -d          # stack; approuter fails on :5000 (macOS AirPlay) — ignore
docker exec -i manufacturing-postgres psql -U postgres -d manufacturing_agent < infra/db/schema.sql   # idempotent migrate
docker compose up -d --build orchestrator frontend                                                    # after code changes
```

UI http://localhost:5173 · API :3000 · iFlow :4000 · login `owner@factorypilot.demo` / `demo-Pass-123`.

## Conventions that bite

- **Adding a service to `ChatService`'s constructor** → also update the fake in
  `orchestrator/src/chat/agent-loop.test.ts` (mock + the arg in BOTH
  `new ChatService(...)` calls) or tests fail.
- **New chat tool** → add to `LOCAL_TOOLS`, handle in `executeLocalTool`, and add
  an LLM-free intent in `handleFallbackWithoutLlm` so it survives model outages.
- **Frontend PWA service worker caches aggressively** — after a rebuild, unregister
  SW + clear caches in the browser or you'll see the old UI. Not a product bug.
- `graphify-out/` is generated (`graphify update .`) and **not** committed.
- Verify live (curl the API / drive the UI), don't just typecheck.

## Feature map (where things live)

| Area | Code |
|---|---|
| Chat agent loop, tools, fallback | `orchestrator/src/chat/chat.service.ts` |
| Autonomy agents (6 specialists, autopilot) | `orchestrator/src/agents/` |
| Governance (scope, policy, anomaly, maker-checker) | `chat.service.ts` + `admin/` |
| Business Object registry (metadata-driven OData) | `business-objects/` |
| SAP landscape connector (iFlow / direct S/4) | `business-objects/sap-iflow.client.ts` |
| Connections (iflow \| s4hana \| btp, sealed secrets) | `connections/` |
| Insights: health · stockout · scenario · suppliers · slotting · ESG | `health/ stockout/ scenario/ suppliers/ slotting/ esg/` |
| LLM providers + routing/BYOM | `llm/` |
| Frontend pages/cards | `frontend/src/components/`, wired in `App.tsx` |

## Phase history

Phases A–R: agentic core → governance → autonomy → multi-tenancy → forecasting →
BYOM → network rebalancer. S: glass-box chat. T: PO-spec alignment (rate-limit
windows, cache policies, audit enrichment, dashboard KPIs). U–V: Business Object
registry + contextualization. W: external iFlow connector. X–Z: health score,
supplier intelligence, slotting. AA–AC: scenario studio, stockout radar, ESG.
AD: Connection Center. Roadmaps + spec gap analysis in `docs/`.

Branch: `version-3`. Commits: `Phase <X> flagship beta: …`.
