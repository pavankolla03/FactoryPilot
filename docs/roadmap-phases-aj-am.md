# FactoryPilot Roadmap — Phases AJ–AM

Two customer iFlows are live and routed per object; writes can post to SAP; every
answer is tagged live vs simulated. What follows is what a pilot still needs.

---

## Phase AJ — Fix the movements feed ← highest value, mostly on the SAP side

`/http/materialdocument` returns **`A_SerialNumberMaterialDocument`** — serial
numbers. Useful for traceability (registered as `SERIAL_NUMBERS`), but it carries
no `Plant`, `StorageLocation`, quantity, `GoodsMovementType` or `PostingDate`, so
it cannot drive movement analytics.

**What to change in the iFlow:** point the OData call at
`API_MATERIAL_DOCUMENT_SRV` → **`A_MaterialDocumentItem`** and map the fields in
`docs/sap-iflow-next-two.md`. Nothing changes in FactoryPilot — register it as a
third connection and the routing picks it up.

**Unlocks:** demand trend & forecasting, days-of-cover in the health score, the
stockout radar's demand side, slotting (needs `StorageLocation`), movement-anomaly
detection, shift handover, ESG handling emissions.

Then the same for **purchase orders** (`A_PurchaseOrderItem`) → PO aging, inbound
coverage, supplier scorecards, the PO-chase agent, ESG transport.

---

## Phase AK — Resilience: last-known-good instead of silent fallback

Today a brief SAP outage makes a live plant fall back to simulated numbers with
only a chip to show it. That is the most dangerous remaining behaviour.

1. Persist the last successful live payload per object/plant.
2. On failure serve it, clearly tagged **"last known good · N minutes old"**,
   instead of reverting to the simulator.
3. Only fall back to simulated data when nothing was ever fetched, and say so.
4. Surface connection health (last success, consecutive failures) in Connections.

---

## Phase AL — Enterprise SSO (Entra ID / OIDC)

Register an OIDC provider as another connection kind: authorization-code login,
JWKS verification, **claim → plant-scope mapping** so access control comes from
the customer's directory, and JIT user provisioning.

---

## Phase AM — Cost + observability for real payloads

Live data changed the cost profile: the stock endpoint returns 2,745 rows and the
serial-number endpoint 9,056, and one answer cost ~10k tokens before projection.

1. Per-object field allow-lists and a row budget per answer.
2. Ask the customer's iFlows to accept `plant` / `top` parameters so filtering
   happens in SAP rather than after a full pull.
3. OpenTelemetry traces across chat → tool → connection → SAP.
4. Eval suite as a build gate.

---

## Sequencing

AJ is mostly your work in Integration Suite and unlocks the most product surface.
AK protects the trust the live data just earned. AL is the enterprise-identity
gate. AM keeps it affordable and debuggable at real payload sizes.
