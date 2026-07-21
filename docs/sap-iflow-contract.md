# FactoryPilot ↔ SAP Integration Suite iFlow — Integration Contract

This is the contract your Cloud Integration (CPI) iFlow must implement so
FactoryPilot's orchestrator can broker Business Object queries through it to
Business Accelerator Hub / S/4HANA OData. FactoryPilot does the NL→OData
translation; **your iFlow is a thin, deterministic OData broker.**

Connection is a config change — set `SAP_IFLOW_URL` (+ auth env vars) on the
orchestrator and it calls your iFlow instead of the local simulator.

---

## 1. Endpoint

- **One HTTPS sender endpoint** handles every business object.
- Default method **POST** with a JSON body (set `SAP_IFLOW_METHOD=GET` to use query
  params instead — same fields).
- Auth (pick one; the orchestrator sends whatever you configure):
  - **Basic** — `SAP_IFLOW_AUTH=basic`, `SAP_IFLOW_USER`, `SAP_IFLOW_PASSWORD`
    (your current choice). The iFlow sender channel uses Basic authentication.
  - API key — `SAP_IFLOW_AUTH=apikey`, `SAP_IFLOW_APIKEY`, `SAP_IFLOW_APIKEY_HEADER`.
  - OAuth2 client-credentials — `SAP_IFLOW_AUTH=oauth2`, `SAP_IFLOW_TOKEN_URL`,
    `SAP_IFLOW_CLIENT_ID`, `SAP_IFLOW_CLIENT_SECRET` (token is fetched + cached).

## 2. Request (what FactoryPilot sends)

`POST <SAP_IFLOW_URL>` with `Content-Type: application/json`:

```json
{
  "service":    "/sap/opu/odata/sap/API_SALES_ORDER_SRV",
  "entitySet":  "A_SalesOrder",
  "filter":     "Plant eq '1040' and RequestedDeliveryDate eq datetime'2026-07-21T00:00:00'",
  "select":     "SalesOrder,SoldToPartyName,Plant,OverallStatus,RequestedDeliveryDate,TotalNetAmount",
  "top":        50,
  "objectCode": "SALES",
  "warehouseId":"1040",
  "todayOnly":  true
}
```

The iFlow only needs `service`, `entitySet`, `filter`, `select`, `top` — the rest
is context. The `filter`/`select` are already valid OData query options; the
orchestrator formats v2 date literals as `datetime'…'` (v4 as bare dates, per the
object's configured version).

## 3. iFlow steps (suggested)

1. **HTTPS Sender** — receive the JSON above.
2. **Content Modifier** — read body fields into properties (`service`, `entitySet`,
   `filter`, `select`, `top`).
3. **Request-Reply → OData/HTTP receiver** to Business Accelerator Hub / S/4:
   - URL: `{BAH_or_S4_base}{service}/{entitySet}`
   - Query: `$filter={filter}` (URL-encoded), `$select={select}`, `$top={top}`,
     `$format=json`
   - Credentials: your api.sap.com APIKey (sandbox) or the tenant destination.
4. **Map** the OData response to the response shape below (a Content Modifier or a
   small Groovy/Message Mapping step). Passing the raw OData body through is also
   fine — FactoryPilot normalizes it.
5. **HTTPS Sender response** — return the JSON.

## 4. Response (what FactoryPilot accepts)

Preferred:

```json
{ "records": [ { "SalesOrder": "30004522", "Plant": "1040", "OverallStatus": "B", ... } ],
  "dataSource": "sap-sandbox" }
```

Also accepted without any mapping (the orchestrator normalizes all three):

- Raw OData v2: `{ "d": { "results": [ ... ] } }`
- Raw OData v4: `{ "value": [ ... ] }`
- A bare array: `[ ... ]`

Field names in each record should match the object's `select_fields` (i.e. the SAP
field names). FactoryPilot's contextualization (status counts, breakdowns,
overdue/today buckets) reads those field names directly.

## 5. Errors

Return a non-2xx status. Optionally include `{ "error": { "message": "…" } }` — the
message is surfaced to the user. FactoryPilot already has a circuit breaker and
graceful fallback around the call.

## 6. Going live — checklist

1. Build the iFlow with the sender endpoint + OData receiver to BAH.
2. Deploy it; copy the runtime HTTPS URL.
3. On the orchestrator set: `SAP_IFLOW_URL`, `SAP_IFLOW_AUTH=basic`,
   `SAP_IFLOW_USER`, `SAP_IFLOW_PASSWORD`.
4. In FactoryPilot → Access Control → Business objects, hit **Test** on an object —
   it does a `top=1` probe through your iFlow and shows the result inline.
5. Ask Otto: "how many sales orders are to be delivered today in warehouse 1040?"
   — the answer's provenance chip flips from *simulator* to *sap-iflow*.

No FactoryPilot code changes are needed to add a sixth object later — register it in
the Business objects card with its service path + entity set, and your one generic
iFlow serves it.
