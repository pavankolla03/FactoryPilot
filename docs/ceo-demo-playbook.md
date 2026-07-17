# FactoryPilot — CEO Demo Playbook

Three end-to-end walkthroughs, ~5 minutes each. Together they cover every capability in the
product. Run them in this order: **Operations → Governance → Economics** — capability first,
then trust, then cost.

**Prep (5 min before the meeting):**
- `docker compose -f infra/docker-compose.yml up -d` — stack running at http://localhost:5173
- Two browser windows: Admin (`owner@factorypilot.demo`) and a scoped Operator
- Admin quota raised (Access Control → tokens/mo) so you never hit 429 mid-demo
- One Slack/Teams channel with an incoming webhook pasted into the admin's user card

---

## Use case 1 — "The Monday Morning" (Operational Intelligence)

*Story: a plant supervisor runs their entire morning routine without opening a single SAP
transaction.*

| Step | What you do | What to say |
|---|---|---|
| 1 | Show the Slack channel: overnight **shift-handover digest** arrived at 06:00 (movements, low stock, triggered alerts) | "Nobody asked for this — FactoryPilot watches the warehouse overnight and reports in." |
| 2 | Open Otto: **"remember that my default warehouse is 1010"** | "Otto has memory — regulars never repeat context." |
| 3 | **"give me the shift handover"** — no warehouse needed, memory fills it in | "One question replaces four SAP transactions." |
| 4 | **"which materials are running low?"** — answer arrives with a **bar chart** above the table, colored by location | "Every numeric answer charts itself. And note the chip: *Grounded in tool data* — this number came from the system, not the model's imagination." |
| 5 | **"what should we reorder?"** — reorder suggestions combine low stock + inbound POs (target − onhand − inbound) | "This is the difference between a chatbot and a copilot: it does the planning math." |
| 6 | **"draft a purchase requisition for 26 units of MAT-10023465"** → approval card → Approve | "It can act — but never without sign-off." |
| 7 | **"receive purchase order PO-4500012346"** → approve → open **Operations Board**: receiving column jumps +500 | "Goods receipt, done conversationally. The kanban board is live stock by location — and dragging a card proposes a governed move." |
| 8 | Set a threshold: **"alert me when MAT-10023456 drops below 100"** — show the alert card | "From now on the system watches this for him. Checked against live stock every minute, delivered to the bell and to Slack." |

**Capabilities shown:** scheduled digests, webhook delivery, Otto memory, shift handover,
low-stock + inbound analysis, reorder suggestions, purchase requisition drafting, goods
receipt, kanban operations board, charts in chat, grounding chip, stock alerts, streaming
chat with the Claude-style UI, voice input & barcode scan (mention: shop-floor PWA).

---

## Use case 2 — "Can We Trust It?" (Governance & Audit)

*Story: the head of IT asks the only question that matters — what stops the AI from wrecking
our inventory? Answer: five independent layers.*

| Step | What you do | What to say |
|---|---|---|
| 1 | Operator window: ask about warehouse 1020 (outside their scope) → clean **403 scope-denied** | "Layer 1: warehouse-level access control. The model can't see what the user can't see — cache hits don't bypass it either." |
| 2 | Same operator, read-only scope: try a move → **read-only rejection** | "Layer 2: read vs write per warehouse, per user." |
| 3 | Admin: small move (qty 3) → **executes instantly** ("auto-approved by policy") | "Layer 3: policy thresholds. You set the number — small moves flow, big ones stop." |
| 4 | Big move (qty 60) → approval card with a red **anomaly banner**: "12.9× the recent average" | "Layer 4: anomaly detection. Unusual quantities are never auto-approved, whatever the policy says." |
| 5 | Try to approve it yourself → **"requires a second approver"** → second admin approves | "Layer 5: maker-checker. The requester can never approve their own action. This is bank-grade four-eyes on an ERP write." |
| 6 | Board: **cycle count** — count 117 vs system 120 → adjustment card shows "(−3)" discrepancy | "Even physical inventory counting is governed — every correction is an approval with the delta on record." |
| 7 | **Activity tab** → click any row → **full drill-down**: exact tool calls, exact arguments, raw JSON results | "For your auditors: not what the AI said — what it actually did. Every request, forever." |
| 8 | Click **Export CSV** | "And here's the file they'll ask for." |

**Capabilities shown:** role + warehouse scoping, read/write levels, per-user and
per-warehouse auto-approve policies, anomaly detection with escalation, maker-checker,
cycle-count adjustments, live audit trail, drill-down to tool calls, CSV export, approvals
tab with badge, notification popover.

---

## Use case 3 — "What Does It Cost?" (Economics & Architecture)

*Story: the CFO question. Answer: near zero to run, and every cent is measured.*

| Step | What you do | What to say |
|---|---|---|
| 1 | Ask a stock question → **"Live from SAP"**. Ask it again → instant, **"Served from cache"** | "Repeat questions never touch the ERP — a 100-day Redis cache with write-invalidation. Watch: after a move, the same question re-fetches. Cache correctness, proven live." |
| 2 | Rephrase the same question slightly → still cache, **0 tokens** in the Activity log | "Query dedupe: same question, differently worded, costs nothing." |
| 3 | **Usage & Cost** tab: traffic-light tiles (green/amber/red on budget %, cache rate, latency), per-day chart, per-user table | "Every user has a monthly token budget. Hit it, and the assistant stops — dashboards keep working. Costs can't run away." |
| 4 | Point at the model column in the data: `poolside/laguna-m.1:free` | "Today's demo ran on free-tier models — routing sends simple lookups to small models and analysis to large ones, with automatic failover. Plug in a premium key and only the env var changes." |
| 5 | The architecture line | "MCP servers ready for SAP BTP Cloud Foundry, XSUAA single sign-on for production, and the SAP connection is a **credential swap, not a rebuild**: paste an api.sap.com key and reads go live against SAP's own sandbox — writes ledger locally until a real S/4 tenant exists." |
| 6 | The trust line | "We ship a 20-case regression suite that verifies the agent picks the right tool on every build, rate limiting per user, and a circuit breaker on the SAP path. It's engineered like infrastructure, not a demo." |

**Capabilities shown:** Redis caching + invalidation, query dedupe, token metering &
quotas, severity-colored cost dashboard, per-user usage table, free-model routing with
fallback, live-SAP switch, MCP/BTP/XSUAA architecture, eval suite, rate limiting, circuit
breaker, EN/DE i18n (flip mid-demo for a DACH audience), landing page + real signup/login.

---

## The closing line

> "Everything you just saw runs on your own tenant, with the LLM of your choice — including
> free ones — behind your own sign-on, with a full audit trail, and every write gated by
> rules you control, not the model. Swapping today's sandbox for your S/4 system is a
> credential change. A six-week pilot on one warehouse proves it on your data."

## Honest caveat to volunteer (before they find it)

Today's data comes from a SAP-schema-accurate sandbox (or SAP's public API sandbox in live
mode, where writes persist in our ledger because SAP's sandbox is read-only). The pilot's
first milestone is pointing the same MCP servers at the customer's real S/4 tenant.
