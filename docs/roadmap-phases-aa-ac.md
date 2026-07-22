# FactoryPilot Roadmap — Phases AA–AC (planning-intelligence wave)

Phases X–Z shipped the operational-intelligence Insights tab (warehouse health,
supplier reliability, slotting). This wave turns FactoryPilot from *describing
today* to *projecting tomorrow* — the "reactive → proactive" pain point, and the
planning depth a CFO/plant-manager buys.

---

## Phase AA — What-if Scenario Studio (the CEO-meeting feature) ← building now

**Why first:** the pitch deck's headline planning feature, and the existing
`simulate`/`simulateScenario` backend only projects *already-low* materials — it
misses items that are healthy now but stock out under a shock. A real studio
projects the **whole warehouse**.

1. **ScenarioService**: whole-warehouse projection over a horizon from three
   levers — **demand multiplier** (×0.5–3), **horizon** (7–60 days), and
   **supplier delay** (0–30 days, delays inbound PO arrival). Per material:
   forecast daily demand (Holt), demand over horizon, inbound arriving in time,
   projected end qty, days-to-stockout, risk band — plus a **baseline vs
   scenario** delta so you see how many *new* stockouts the shock creates.
2. **`POST /api/ops/scenario`** and a **Scenario Studio card** on Insights:
   sliders, summary tiles (stockouts, at-risk, units short, vs-baseline), a
   per-material table with stockout highlighting, and an inline projection chart.
3. Zero writes — pure projection.

**Exit:** "demand +50% and supplier delay +14 days" projects the resulting
stockouts across the warehouse, live, with a baseline comparison.

---

## Phase AB — Predictive Stockout Radar (proactive alerting)

**Why second:** the studio is on-demand; the radar is always-on. It ranks every
material by **days-to-stockout** (forecast demand vs on-hand + timed inbound),
surfaces the soonest risks not covered by inbound, and offers one-tap **draft PR
/ create alert**. A scheduled pass raises a notification when a material crosses
a lead-time-aware threshold (using the supplier's measured lead time from Phase Y).

**Exit:** a ranked radar of imminent stockouts with actions; proactive
notifications before a material runs out.

---

## Phase AC — ESG / Sustainability report

**Why third:** a differentiator few SAP copilots touch, computable from data
already flowing. Estimate carbon from movements and inbound transport (distance ×
freight mode), trend it, and export a per-warehouse ESG summary. Surfaces as an
Insights card + a report the sustainability team can file.

**Exit:** a per-warehouse carbon estimate with trend and CSV export.

---

## Sequencing

AA proves the planning brain interactively (sell it in the room); AB makes it
always-on (retention); AC opens a new buyer (sustainability). All three build on
the forecast + movement data already in the product — no new SAP dependency.
