# The next two iFlows — movements and purchase orders

Your first iFlow (`/http/materialstockread`) made material stock live. These two
unlock most of what still reads from the simulator. Build them exactly like the
first one — same tenant, same OAuth2 service key, same message-mapping XML output.
FactoryPilot already parses that shape, so **no code change is needed** on our
side; you register the endpoint in **Connections** and it goes live.

---

## 1. Movements — `/http/materialmovementsread`

**OData source:** `API_MATERIAL_DOCUMENT_SRV` → `A_MaterialDocumentItem`

**Unlocks:** demand trend and forecasting, days-of-cover in the health score,
the stockout radar's demand side, the slotting optimizer (pick frequency),
movement-anomaly detection, shift handover, and ESG handling emissions.

**Fields to map** (SAP names, kept as-is):

| Field | Why it's needed |
|---|---|
| `MaterialDocument`, `MaterialDocumentItem` | document identity |
| `Material` | which material moved |
| `Plant` | plant filter |
| `StorageLocation` | **required for slotting** (pick face vs reserve) |
| `QuantityInEntryUnit` | movement quantity |
| `EntryUnit` | unit |
| `GoodsMovementType` | 101 receipt / 601 issue / 201 / 261 — direction |
| `PostingDate` or `DocumentDate` | **required** for the 14–30 day trend window |
| `IssuingOrReceivingStorageLoc` | from → to, if available |

**Suggested `$filter` inside the iFlow:** last 30 days by `PostingDate`, so the
payload stays small.

---

## 2. Purchase orders — `/http/purchaseordersread`

**OData source:** `API_PURCHASEORDER_PROCESS_SRV` → `A_PurchaseOrderItem`
(expand `to_PurchaseOrder` for header fields)

**Unlocks:** PO aging in the health score, inbound coverage in the stockout radar
(the "covered by inbound" badge), supplier scorecards and measured lead times,
the PO-follow-up agent, and ESG transport emissions.

**Fields to map:**

| Field | Why it's needed |
|---|---|
| `PurchaseOrder`, `PurchaseOrderItem` | PO identity |
| `Material` | what was ordered |
| `Plant` | plant filter |
| `OrderQuantity`, `PurchaseOrderQuantityUnit` | inbound quantity |
| `Supplier` (and `SupplierName` if available) | supplier scorecards |
| `ScheduleLineDeliveryDate` or `DeliveryDate` | **required** for overdue / ETA |
| `CreationDate` (header) | measured lead time = delivery − creation |
| `PurchasingDocumentDeletionCode` / a status field | open vs delivered |

---

## Contract reminders (same as the first iFlow)

- **GET**, OAuth2 client-credentials with your existing service key.
- XML message-mapping output is fine — a wrapper element containing repeated row
  elements. JSON (`{"records":[...]}`) or raw OData also work.
- Register in **Connections → iFlow**, set **fixedEndpoint = true**, and put the
  entity set in *Test entity set* (e.g. `A_MaterialDocumentItem`).

## One upgrade worth considering

Today the endpoint returns every row (2,745 for stock) and FactoryPilot filters
client-side. If the iFlow accepted **`plant`** and **`top`** query parameters and
passed them into `$filter` / `$top`, payloads and latency would drop sharply —
FactoryPilot already sends those parameters when `fixedEndpoint` is off.

## After you deploy each one

1. **Connections → iFlow → Connect**, paste the URL, same OAuth2 credentials.
2. **Test** — expect "Reachable via iFlow (oauth2 auth) — N row(s)".
3. Coverage (same page) flips that object from *simulated* to *live*, and the
   Insights cards start reading real data automatically.
