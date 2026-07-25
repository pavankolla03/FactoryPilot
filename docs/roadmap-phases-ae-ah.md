# FactoryPilot Roadmap — Phases AE–AH (pilot-readiness wave)

AD made the SAP landscape connectable from the UI. This wave is what a customer
asks for **between "the demo works" and "we can run it"** — identity, trust in
the numbers, safety at scale, and proof it keeps working.

Ordered so each phase unblocks the next procurement question.

---

## Phase AE — Enterprise SSO (Entra ID / OIDC) ← next

**Question it answers:** "Can our people sign in with corporate identity?"

1. Register an OIDC provider per org from the Connection Center (`kind: 'oidc'`
   — issuer, client id/secret, scopes), reusing the sealed-secret storage.
2. Authorization-code login flow alongside the existing local/XSUAA modes;
   JWKS-verified tokens.
3. **Claim → role/scope mapping** (e.g. group `WH-1010-WRITE` → warehouse 1010
   write), so access control is driven by the customer's directory, not by hand.
4. Just-in-time user provisioning on first login.

**Exit:** a user signs in with Entra ID and lands with the right warehouse scopes.

---

## Phase AF — Data Quality & Trust Guardrails

**Question it answers:** "How do we know the agent's numbers are right?"

1. **Freshness + provenance on every answer**: which system served it, when it
   was fetched, cache age — surfaced in the chat footer (extends the glass-box).
2. **Reconciliation check**: periodically compare a sample of cached/derived
   values against live SAP and raise a drift alert when they disagree.
3. **Registry guardrails**: validate OData `default_filters` syntax and dry-run a
   row count when a business object is saved, so a bad filter fails at config
   time instead of silently returning nothing.
4. **Empty-vs-error distinction** everywhere (today "0 rows" and "call failed"
   can look alike to a reader).

**Exit:** every number carries provenance + freshness; a bad registry entry is
rejected at save time; drift raises an alert.

---

## Phase AG — Safety at Scale (multi-warehouse rollout)

**Question it answers:** "What happens when this runs across 50 plants?"

1. **Blast-radius controls**: per-org daily write budgets and a global kill
   switch; autopilot concurrency caps.
2. **Change windows / freeze calendar** (extend `warehouse_policies`): no
   autonomous writes during stock-take or month-end close.
3. **Simulation mode per org**: run every agent in propose-only for N days, then
   report what *would* have happened — the standard way pilots earn trust.
4. **Scale hygiene**: paginate/window the per-warehouse scans that currently fan
   out across all warehouses (health, radar, ESG) so 50 plants stay sub-second.

**Exit:** a 50-warehouse tenant runs with bounded blast radius and a
"what would have happened" report.

---

## Phase AH — Observability + eval CI

**Question it answers:** "How do you know it still works after a change?"

1. OpenTelemetry traces spanning chat → tool → MCP → SAP (one trace per request;
   the glass-box timeline already models the spans).
2. The 20-case agent eval wired into CI with a quality gate, plus the
   feedback→eval-case promotion flow already in the product.
3. Golden-answer regression for the Insights math (health score, radar,
   scenario) so a refactor can't silently change a number.

**Exit:** a request is traceable end-to-end; regressions fail the build.

---

## Sequencing

AE unblocks enterprise login (always the second question after "is it secure?").
AF makes the numbers defensible — the thing that kills pilots is one wrong figure.
AG is what turns one warehouse into fifty safely. AH keeps all of it honest.
