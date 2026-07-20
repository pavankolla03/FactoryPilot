# FactoryPilot Roadmap — Phases S–V (agentic depth wave)

Phases A–R shipped the agentic core, governance, go-live pack, forecasting,
BYOM routing, autopilot, and the network rebalancer. This wave closes the
remaining gaps between "impressive agent demo" and "the planning brain a
warehouse actually runs on": transparency of the agent itself, then the three
intelligence layers SAP users pay for — health, suppliers, and slotting.

---

## Phase S — Glass-Box Chat (trust through transparency) ✅ shipped in beta

**Pain point:** while Otto works, the user stares at a static "thinking…"
line. Operators don't trust what they can't see; auditors ask "what did it
actually touch?" *before* approving a pilot.

1. **Live agent activity timeline**: new `chat:status` socket event streams
   every tool invocation as it happens — tool name, which server answered
   (MCP Inventory / MCP Warehouse Ops / Orchestrator), arguments, per-call
   duration, cache hit, and pending-approval state for deferred writes.
2. **Claude-style working block**: shimmering status label ("Thinking…" →
   "Running get stock level…" → "Writing the answer…"), live elapsed timer
   ticking at 100 ms, tool steps sliding in with spinner → ✓/⏸/! state.
3. **Persistent turn summary**: finished answers carry a collapsible
   "Worked for 3.2s · 2 tool calls · 2 rounds" row that expands to the full
   timeline with arguments — plus a footer with response time, model used,
   and token count on every answer.
4. `chat:done` now carries `stats` (elapsed, rounds, tools, model, tokens)
   and the full `toolEvents` array, so the UI needs no guesswork.

**Exit criteria:** every chat answer shows its response time; every tool hit
is visible live and afterwards; write-approval steps appear in the timeline.

---

## Phase T — Warehouse Health Score + "Explain Why" (the ops heartbeat)

**Pain point:** SAP gives numbers, not judgment. A supervisor's first
question every morning is "are we OK?" — today that takes five queries.

1. **Composite health score per warehouse** (0–100, computed on schedule):
   stockout-risk coverage (days-of-demand from the existing Holt forecast),
   low-stock breadth, open-PO aging, movement-anomaly rate, forecast error
   (MAPE from outcome scoring). Weighted, with per-factor sub-scores.
2. **Command Center tiles** go from counts to judgment: score + trend arrow
   + the single biggest detractor ("1030: 62 ▼ — 4 materials under 3 days
   of cover").
3. **One-click root cause**: "Explain" on a tile drops the score's factor
   breakdown into chat and asks Otto to investigate — the timeline from
   Phase S shows exactly which data it pulled.
4. Health history table (per warehouse per day) so the trend is real, not
   recomputed on the fly.

**Exit criteria:** every warehouse shows a live score with trend; "explain"
produces a grounded root-cause answer citing tool data.

---

## Phase U — Supplier Intelligence (the procurement moat)

**Pain point:** replenishment quality is capped by lead-time guesses. SAP
has the PO history; nobody turns it into supplier judgment.

1. **Supplier scorecards** derived from PO history: on-time delivery rate,
   actual vs promised lead time (p50/p90), quantity fill rate, trend.
2. **Lead-time-aware replenishment**: reorder points use the supplier's
   *measured* p90 lead time instead of a static assumption — safety stock
   follows reality.
3. **PO-chase prioritization**: the PO follow-up agent escalates late POs
   from chronically-late suppliers first, and says so in its rationale.
4. **Scorecard surface**: a Suppliers card in the Command Center + chat tool
   (`getSupplierScorecard`) so Otto can answer "which supplier is our
   biggest risk?".

**Exit criteria:** replenishment proposals cite measured lead times; the
PO-chase agent's plan orders by supplier reliability; scorecards visible in
UI and chat.

---

## Phase V — Slotting Optimizer Agent (the 7th specialist)

**Pain point:** pickers walk kilometers because fast movers sit in the back.
Slotting studies are consultant work; the movement history to do it lives in
the system already.

1. **Pick-frequency analysis** from movement history: velocity class per
   material per location (fast/medium/slow), mismatch detection (fast mover
   in bulk, slow mover hogging packing).
2. **Slotting agent** proposes relocations ("MAT-…465 → packing: picked 14×
   this week from bulk") through the same plan→execute→verify run machinery,
   approval cards, anomaly checks, and audit trail as every other write.
3. **Outcome verification**: after execution, the verify step measures
   whether picks from the new location actually happened — feeding the same
   outcome cards as replenishment.

**Exit criteria:** the agent produces ranked relocation proposals with
rationale; approved moves execute and verify; goal type selectable in the
Autonomy tab.

---

## Sequencing logic (one paragraph)

S first because trust is the currency of every later approval — a visible
agent gets approved faster than a black box. T converts data into the daily
judgment call that makes the product habit-forming. U deepens the moat where
the money is (procurement) using data already flowing. V is the most
SAP-differentiated feature — it turns the agent from a stock clerk into a
warehouse engineer, and it reuses every piece of machinery the earlier
phases hardened.
