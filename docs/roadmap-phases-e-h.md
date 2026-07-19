# FactoryPilot Roadmap — Phases E–H

Phases A–D shipped the agentic core: three agents (replenishment, cycle-count,
rebalancer) with plan→execute→verify runs, an LLM critic, outcome tracking,
episodic memory, one-click + Slack-payload approvals, dry-run simulation,
change windows, API keys + `/api/v1/ask`, fleet metrics, feedback review, and
retention. What follows is ordered by *what blocks the next dollar/pilot*, not
by what is most fun to build.

---

## Phase E — Go Live (public pilot deployment)

**Why first:** three shipped features (Slack interactive app, PWA install on
real phones, shareable pilot links) are dormant purely because the app has no
public URL. Every later phase produces feedback faster once outsiders can
touch the product.

1. **Hosting**: frontend on Netlify/Vercel; orchestrator + MCP servers +
   simulator on Render/Fly (Docker images already exist); managed Postgres
   (Neon) + Redis (Upstash) free tiers — matching the README's own guidance
   against CF-buildpack databases. Alternative: SAP BTP CF trial using the
   existing `manifest.yml` + XSUAA descriptor.
2. **Secrets & config**: move `.env` values to host secret stores; rotate
   `AUTH_JWT_SECRET`; set `PUBLIC_BASE_URL` (quick-approve links),
   `EVENT_INBOUND_SECRET`, real webhook URLs.
3. **Slack app**: create the app, point interactivity to
   `/api/agents/integrations/slack/actions`, convert approval webhooks to
   Block Kit buttons whose value is the quick-approve JWT (endpoint already
   accepts this payload shape).
4. **Demo seeding**: one script that resets fixtures, creates the three demo
   users, two goals per agent type, and one pending approval — so every demo
   starts from the same photogenic state.
5. **Ops basics**: uptime monitor on `/health`, error alerting to the owner
   webhook, daily Postgres backup.

**Exit criteria:** a URL you can send the CEO; approve an agent's plan from a
phone via Slack; PWA installed on a real device.

---

## Phase F — Enterprise Readiness (sell to a second customer)

**Why second:** no company pilots software that cannot isolate their data or
plug into their identity provider. This phase converts "impressive demo" into
"procurable product".

1. **Multi-tenancy**: `organizations` table; `org_id` on users, goals, runs,
   policies, alerts, reports, episodic memory, api_keys; every query scoped;
   Redis keys namespaced per org; per-org token quotas and retention.
   First user of an org = org admin (mirrors current first-user-is-admin).
2. **SSO**: production XSUAA path validated end-to-end on BTP; optional OIDC
   (Entra ID) for non-SAP-IdP buyers. API keys become org-scoped.
3. **Observability**: OpenTelemetry traces across orchestrator → MCP →
   simulator (span per tool call, per LLM round, per agent step); metrics
   (run latency, LLM fallback rate, cache hit rate, approval latency);
   Grafana/console dashboard. The agent-step timeline already exists — OTel
   makes the same story machine-queryable.
4. **Compliance surface**: audit-log export (CSV + webhook to SIEM),
   per-tenant retention overrides, data-deletion endpoint (GDPR-style),
   backup/restore runbook.
5. **Hardening**: dependency audit in CI, security headers, per-key rate
   limits on `/api/v1/ask`, secrets scanning, threat-model doc.

**Exit criteria:** two organizations on one deployment with provably isolated
data (a cross-tenant test suite proves the negative); SSO login; OTel trace
for one full agent run.

---

## Phase G — Deep SAP + Planning Intelligence (the differentiator)

**Why third:** with a public, tenant-safe product, the moat is depth: being
*the* planning brain on top of SAP data, not a chat wrapper.

1. **Real SAP breadth** (starts the day the api.sap.com key lands): activate
   the dormant live layer; add read tools for Production Orders
   (`API_PRODUCTION_ORDER_2_SRV`), Suppliers (`API_BUSINESS_PARTNER`), and
   batches; provenance chips already display dataSource.
2. **Forecasting agent** (4th agent): per-material demand forecast from
   movement history (moving average → Holt-Winters; no vector DB needed —
   pure time series). Output feeds the replenishment target instead of the
   static 2×-threshold rule.
3. **Safety-stock recommender**: service-level-driven reorder points
   (demand variance × lead time); surfaces as proposals with rationale, same
   approval machinery.
4. **What-if planner UI**: generalize `/api/agents/simulate` into a scenario
   tab — "demand +30% for 2 weeks", "supplier lead time doubles" — projected
   stockouts and cost, zero writes. This is the CEO-meeting feature.
5. **PO follow-up agent** (5th agent): watches open POs past their expected
   date, drafts supplier chase notifications, escalates to humans.

**Exit criteria:** forecast-driven replenishment live with measured forecast
error (MAPE) on the outcome cards; one what-if scenario demonstrable
end-to-end; live SAP reads on a real tenant or full-breadth sandbox.

---

## Phase H — Quality Flywheel & Scale (compound advantage)

**Why last:** these multiply the value of everything above and need the
traffic the earlier phases generate.

1. **Eval CI**: nightly run of the agent regression suite against the live
   model chain; promotion flow that turns `/api/agents/feedback-review`
   entries (thumbs-down + question) into new eval cases with one click;
   block deploys on eval regression. Target: 20 → 100+ cases.
2. **Outcome-driven model routing**: score each OpenRouter model by grounded
   rate, tool-call validity, and run effectiveness; the router prefers the
   best-performing free model per query class instead of a static chain.
3. **Cost & adoption analytics**: per-tenant token cost dashboards; autonomy
   adoption metrics (% of writes agent-initiated, approval latency,
   effectiveness trend) — the numbers a renewal conversation runs on.
4. **Resilience drills**: chaos tests (kill Redis, kill the LLM, 500s from
   SAP) asserting graceful degradation (circuit breaker, fallback answers,
   run `failed` states with clean errors); load test `/api/chat` and
   `/api/v1/ask`.
5. **Scale prep**: horizontal orchestrator (Socket.IO Redis adapter, cron
   leader election), read replicas if needed.

**Exit criteria:** eval suite ≥100 cases wired into CI; model router chooses
by measured outcome; documented degradation behavior for all three
dependency failures.

---

## Sequencing logic (one paragraph)

E unblocks distribution (everything else compounds faster with users);
F unblocks procurement (no isolation, no contract); G builds the moat
(planning intelligence on SAP data is the product, chat is the interface);
H compounds quality and defends the moat (evals + outcome-routing turn every
user interaction into a better product). Standing dependency: the user's
api.sap.com key activates the live layer whenever it arrives — it slots into
any phase without re-planning.
