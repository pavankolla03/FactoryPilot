# FactoryPilot Roadmap — Phases AG–AJ (real-landscape wave)

The customer's first iFlow is live: material stock for plant 1010 flows from the
BTP tenant into chat, the Operations Board and the Insights cards, and every
answer is tagged live vs simulated. This wave closes the gap between *one live
object* and *a pilot running entirely on customer data*.

Ordered by what currently blocks the demo from being fully real.

---

## Phase AG — Real plants + more live objects ← next

**The gap:** FactoryPilot's warehouse list is still the demo set (1010–1050).
The customer's SAP has 1010, 1710, 3010, US30, DE20… — only **1010 overlaps**, so
every other screen silently shows simulated data. And stock is the only live
object; movements, purchase orders and demand still come from the simulator.

1. **Warehouse list from the landscape**: derive selectable plants from live data
   (`LiveDataService.livePlants()`), instead of the hard-coded 1010–1050 in the
   sidebar, board, agents and Insights services. Plants with no live rows are
   labelled as demo data.
2. **Two more iFlows, same pattern** — each is a registry row plus a mapping, no
   new plumbing:
   - **Movements** → `API_MATERIAL_DOCUMENT_SRV` / `A_MaterialDocumentItem`
     (unlocks demand trend, slotting, anomaly detection, shift handover).
   - **Purchase orders** → `API_PURCHASEORDER_PROCESS_SRV` / `A_PurchaseOrderItem`
     (unlocks PO aging, inbound coverage in the stockout radar, supplier scorecards).
3. **Params-aware iFlow (optional but valuable)**: today the endpoint is fixed and
   FactoryPilot filters client-side after pulling 2,745 rows. An iFlow that accepts
   `plant` / `top` would cut latency and payload dramatically.
4. **Coverage panel** in Connections: per business object — live or simulated,
   row count, last fetch — so the gap is visible instead of inferred.

**Exit:** the plant selector lists the customer's real plants, and stock,
movements and POs are all live; the Insights cards read real SAP end to end.

---

## Phase AH — Write-back through the iFlow

**The gap:** reads are live but every write (stock move, purchase requisition,
goods receipt) still goes to the local ledger. The governance story — approval
cards, maker-checker, audit — is real, but the effect is simulated.

1. A **write iFlow contract** (POST, JSON in/out) for `moveStock` /
   `createPurchaseRequisition`, mirroring the read contract already documented.
2. Route confirmed writes to the live connection when one is registered, keeping
   the existing approval + anomaly + maker-checker gates unchanged.
3. **Write provenance + reversal record**: every executed write records the SAP
   document number it created (or the ledger id when simulated).

**Exit:** an approved move creates a real SAP material document, and the audit
row carries the SAP document number.

---

## Phase AI — Enterprise SSO (Entra ID / OIDC)

Deferred from the previous wave and still the standard second procurement
question. Register an OIDC provider as a 4th connection kind, authorization-code
login, JWKS verification, and **claim → warehouse-scope mapping** so access
control comes from the customer's directory. JIT user provisioning.

**Exit:** a user signs in with Entra ID and lands with the right plant scopes.

---

## Phase AJ — Pilot hardening

1. **Resilience**: cache the last good live payload and serve it (clearly tagged
   "last known good, N minutes old") when SAP is briefly unreachable, instead of
   falling back to simulated numbers.
2. **Observability**: OpenTelemetry traces across chat → tool → live connection →
   SAP, plus the eval suite as a build gate.
3. **Cost**: the live payload made a single answer ~10k tokens before projection.
   Add per-object field allow-lists and a row budget per answer.

**Exit:** a brief SAP outage degrades honestly; a request is traceable end to end;
regressions fail the build.

---

## Sequencing

AG makes the whole product real rather than one object. AH makes it act on the
real system, which is what a pilot ultimately signs off. AI unblocks enterprise
identity. AJ is what makes it survivable in production.
