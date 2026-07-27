# Roadmap AP–AS

Where things stand after AN/AO: nine of seventeen read tools serve live SAP.
What remains is not mostly code — it is that four fixed-endpoint iFlows cannot
express the questions the product asks. These phases split into work that needs
nothing from the customer (AP, AS) and work gated on new iFlows (AQ, AR).

## AP — writes that actually reach SAP *(no customer dependency)*

Every read path is live; every write still lands in the simulator ledger unless
an `iflow-write` connection exists. That is the largest remaining honesty gap,
because the UI presents an approved movement as done.

- Make the write path's provenance explicit end to end: an approved action shows
  `posted to SAP` vs `recorded locally (no write iFlow connected)` in the
  approval card and the audit trail, not just in logs.
- `live-write.service.ts` already throws on non-2xx rather than falling back —
  surface that failure to the approver instead of a generic error.
- Refuse to render "posted" language anywhere no write connection is active.

This is the same withhold-don't-annotate rule applied to writes.

## AQ — purchase order items *(needs `A_PurchaseOrderItem`)*

The single highest-value iFlow left. `API_PURCHASEORDER_PROCESS_SRV` →
`A_PurchaseOrderItem` carries Plant, Material, quantity and delivery date, which
unlocks in one step:

- plant-scoped purchase orders (currently returns `unavailable` by design)
- inbound quantity and ETA per material — feeds stockout radar and coverage
- supplier reliability scoring (delivery date vs actual is the missing signal
  that currently forces every supplier to "not scored")
- the PO-chase agent, which has no real overdue signal today

## AR — a movement feed with posting dates *(needs a header projection)*

`A_MaterialDocumentItem` has no posting timestamp, so `sinceHours` is ignored and
demand history cannot be built. Either `A_MaterialDocumentHeader` or PostingDate
projected onto the item feed would enable:

- honest "movements in the last 24h"
- `getDemandTrend` off real consumption instead of the simulator, which in turn
  makes forecasting and reorder points real rather than illustrative

## AS — prove the honesty rules hold *(no customer dependency)*

The PO-attribution bug was caught by reading one answer closely. That does not
scale as objects are added.

- Eval cases that assert refusal, not just retrieval: a plant-scoped PO question
  must not name a plant; a movements question must not say "last 24 hours"; a
  supplier question must not invent a name. These are cheap to run and would
  have caught all three regressions this week.
- Wire them into `npm run verify` behind `EVAL_MIN_PASS_RATE`.
- A registry-level check that flags any business object whose `default_filters`
  reference a field absent from a live `preview` — exactly the
  `PURCHASING`/`Plant` mismatch, caught automatically.

## AT — the free model is the remaining latency, not the code

With greetings short-circuited, what is left is genuinely model-bound: a live
stock question took ~130s end to end, of which the SAP fetch is ~2s. Options, in
order of effort:

- Stream the first tool result into the answer so the user sees data at ~3s
  rather than waiting for the whole completion.
- Route simple single-tool questions ("stock in 1710") to a table renderer with
  no second LLM round — the data is already structured; the model is only
  formatting it.
- Make the model configurable per question class (BYOM already exists): a fast
  small model for retrieval-shaped questions, the larger one for analysis.

The second is the biggest win and needs no new infrastructure.

## Order

**AP then AS** — both are unblocked and both close honesty gaps that currently
mislead. AQ is the biggest functional win but waits on the customer; AR unlocks
forecasting and waits on the same. If the PO-item iFlow arrives first, do AQ
ahead of AS.
