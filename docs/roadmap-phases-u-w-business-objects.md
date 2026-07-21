# FactoryPilot Roadmap — Phases U–W (Business Object coverage)

Goal of this wave: **close every remaining functionality in the PO's Technical
Design + Functional documents.** After the Phase T spec-alignment wave (rate
limits, cache policies, audit enrichment, dashboard KPIs), the one pillar still
missing is the spec's objective #1 — a metadata-driven Business Object registry
so functional consultants add SAP objects (Sales, Delivery, Shipping, Goods
Movement, Purchasing) with **zero code change**, served through one generic
iFlow, contextualized by the LLM, cached and logged.

Design follows SAP's own MCP guidance (community blog): **intent-shaped tools,
business rules in the server not the prompt, governed at the gateway,
agent-friendly errors.**

Coverage map to the documents:

| Document component | Covered by |
|---|---|
| App 1 — Business Object Configuration | **Phase U** |
| Generic CPI iFlow (one flow, all objects) | **Phase U** |
| App 2 — User Token / Rate-Limit Control | ✅ Phase T |
| App 3 — Cache Configuration | ✅ Phase T |
| Component 5 — Contextualization & business rules | **Phase V** |
| Business objects: Sales, Delivery, Shipping, Goods Movement, Purchasing | **Phase V** |
| Component 6 — Logging & audit | ✅ Phase T |
| Component 7 — Monitoring dashboard | ✅ Phase T |
| LLM gateway (OpenRouter) | ✅ shipped |
| Live S/4 via Business Accelerator Hub OData | **Phase W** |

---

## Phase U — Business Object Registry + generic query path

**Why first:** it is the spec's #1 objective and unblocks every business object
below without per-object code.

1. **`business_objects` table** (mirrors the spec's `BusinessObjectConfig`):
   `object_code`, `object_name`, `keywords`, `destination_name`,
   `odata_service_path`, `entity_set`, `default_filters`, `select_fields`,
   `api_version` (v2/v4), `top_limit`, `is_active`, managed timestamps. Org-scoped.
2. **Admin UI** (Access Control → "Business objects" card): CRUD list + object
   form, `is_active` toggle, and a **Test connection** action that pings
   `$metadata` on the configured service through the iFlow and reports OK/fail
   before activation — exactly the spec's validation step.
3. **Generic `queryBusinessObject` tool** (orchestrator-local, intent-shaped):
   resolves an `objectCode` (or lets the LLM pick by keywords), merges user
   filters with the configured `default_filters`, builds `$filter/$select/$top`
   for the object's OData version, calls it through the iFlow, and returns
   normalized records. One tool, every object — the spec's "one generic iFlow,
   not one per object".
4. **iFlow generic OData passthrough**: `GET /iflow/odata` in the simulator that
   proxies a service-path + query to the backend (mock fixtures now; Business
   Accelerator Hub in Phase W). Same circuit-breaker / cache / audit path as the
   existing tools.
5. **Discovery**: active business objects are injected into Otto's tool
   context so intent resolution routes free-text ("orders to deliver today") to
   the right object — the spec's Step 3, done with real tool-calling.

**Exit:** an admin registers a new SAP object in the UI, tests the connection,
and Otto answers questions about it with zero deploy.

---

## Phase V — The five business objects + contextualization rules

**Why second:** with the registry live, breadth is now configuration + a thin
contextualization layer. Delivers the spec's headline query
*"How many orders are to be delivered/shipped today in my warehouse?"*

1. **Seed the five spec objects** (against the BAH sandbox service names):
   - **Sales** — `API_SALES_ORDER_SRV` / `A_SalesOrder`
   - **Delivery** — `API_OUTBOUND_DELIVERY_SRV` (or `API_DELIVERY_DOCUMENT_SRV`) / delivery header
   - **Shipping** — outbound delivery + shipping point / route / carrier fields
   - **Goods Movement** — `API_MATERIAL_DOCUMENT_SRV`, movement types (101 receipt, 601 issue, …)
   - **Purchasing** — `API_PURCHASEORDER_PROCESS_SRV` / `A_PurchaseOrder`
2. **Per-object contextualization** (business rules in the server, spec Component 5):
   - Sales: count by status, "to be delivered today".
   - Delivery / Shipping: group by warehouse / route / carrier; pending vs shipped.
   - Goods Movement: summarize by movement type (101/601/…).
   - Purchasing: open POs, due today, overdue (already partly live).
   Output the spec's shape: `summaryText` + `metrics` + `breakdowns` + `metadata`.
3. **Warehouse/plant defaulting**: "my warehouse" resolves from the user's
   `default_warehouse` preference (already stored) — the spec's `{userPlant}`.
4. **Charts-in-chat** reuse: counts/breakdowns render as the existing inline
   bar charts and tables automatically.

**Exit:** all five business objects answerable in chat with grounded numbers and
the spec's example queries working end-to-end.

---

## Phase W — Live SAP via Business Accelerator Hub OData

**Why last:** it flips the same registry from mock fixtures to real sandbox data
— a credential change, no re-architecture, per the README's own promise.

1. **Live OData in the iFlow**: activate the dormant live layer for the generic
   passthrough — call `api.sap.com` S/4HANA Cloud sandbox OData for the
   registered services when `SAP_API_KEY` is set; fall back to fixtures otherwise.
2. **Per-object destinations/credentials**: `destination_name` on each business
   object resolves base URL + auth (sandbox API key now; BTP destination +
   principal propagation on a real tenant).
3. **Provenance**: every answer's records carry `dataSource` (live vs simulator)
   and surface the existing "Live from SAP" / cache chips.
4. **Write path** stays ledgered (BAH sandbox is read-only) until a real S/4
   tenant exists — unchanged from today.

**Exit:** with an api.sap.com key set, the five business objects read live from
SAP's sandbox through the registry, provenance-chipped, with no code change to
add the sixth object.

---

## After this wave

The product-depth phases from `roadmap-phases-s-v.md` (warehouse health score,
supplier intelligence, slotting optimizer) shift to **X–Z** and run after full
document coverage is proven. At that point every line of the PO's TDD and
functional spec is implemented or exceeded, and the SAP-differentiated
intelligence sits on top.
