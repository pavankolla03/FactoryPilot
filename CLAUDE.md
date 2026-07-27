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

## Live SAP vs simulator — read before answering "is X real data?"

Customer tenant: BTP trial `674521f2trial`, four **fixed-endpoint, GET-only**
iFlows (they ignore OData params; the client parses XML/JSON and filters
client-side). Credentials are OAuth2, sealed in `connections.secrets_enc`.

| iFlow path | Entity set | Feeds |
|---|---|---|
| `/http/materialstockread` | `A_MatlStkInAcctMod` | stock, low stock, summary, materials |
| `/http/materialdocument` | `A_MaterialDocumentItem` | goods movements |
| `/http/purchaseorder` | `A_PurchaseOrder` (**header only**) | purchase orders, suppliers |
| `/http/physicalinventory` | `A_PhysInventoryDocItem` | count documents, variances |

**Live** (`LIVE_TOOLS` in `live/live-data.service.ts`): getStockLevel,
listWarehouseStock, getLowStock, getWarehouseSummary, getRecentMovements,
getPurchaseOrders, searchMaterials, getMaterialDetails, getSuppliers.

**Still simulator** — genuinely needs iFlows the customer has not built:
getDemandTrend (needs posting dates), getProductionOrders, getPurchaseRequisitions,
and all writes (`live-write.service.ts` posts to an `iflow-write` connection).

**Known data limits — never paper over these:**
- PO headers have **no plant, material or quantity**. A plant-scoped PO request
  returns `unavailable` with no `records` array on purpose.
- `A_MaterialDocumentItem` has **no posting timestamp**, so `sinceHours` is not
  applied. Never describe movements as "last 24 hours".
- No product master → material **descriptions are null**; no business-partner
  feed → supplier **names are null**. Do not invent either.

**The rule that matters:** when the payload cannot support the question, withhold
the rows — do not annotate them. Prose caveats and boolean flags were both tried
and the model still fabricated plant scoping; removing `records` is what worked.

## Phase history

Phases A–R: agentic core → governance → autonomy → multi-tenancy → forecasting →
BYOM → network rebalancer. S: glass-box chat. T: PO-spec alignment (rate-limit
windows, cache policies, audit enrichment, dashboard KPIs). U–V: Business Object
registry + contextualization. W: external iFlow connector. X–Z: health score,
supplier intelligence, slotting. AA–AC: scenario studio, stockout radar, ESG.
AD: Connection Center. Roadmaps + spec gap analysis in `docs/`.

AD: Connection Center. AF–AK: live SAP adapter, landscape service, live writes,
last-known-good resilience. AM: row budget + payload observability. AN: movements,
physical inventory, purchase orders live. AO: materials + suppliers off the
simulator. AP: write provenance. AQ: LLM-failure honesty + expandable SAP
evidence trail per tool step. AS: evals that assert refusal, not just retrieval.
AT: real cost accounting (`llm/model-pricing.ts`, `token_usage.cost_usd`).
AU: registry validation — `POST /api/admin/business-objects/validate-all` checks
every configured field against a live preview. Run it after any registry or
iFlow change; it has caught three silent misconfigurations so far.
Roadmaps in `docs/`.

Branch: `version4`. Commits: `Phase <X>: …`.

## Keeping context small

`graphify query` first, always. Beyond that, the two things that actually cost a
session are re-deriving the live/simulator split (see the table above — keep it
current) and re-discovering iFlow payload shapes. For the latter use
`POST /api/admin/business-objects/:id/preview`, which returns real rows plus the
field names SAP actually returned — a fixed endpoint often serves a different
entity set than the registry claims, and this is how two such mismatches were caught.
