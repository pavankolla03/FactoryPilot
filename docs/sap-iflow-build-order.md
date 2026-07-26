# Which iFlows to build — ranked by what they unlock

FactoryPilot's connector already handles **OData V2** (`d.results`), **V4**
(`value`) and the **XML** your message mapping emits, so both API groups work.
Each object also carries an `api_version` in the registry, which controls date
literal syntax (`datetime'…'` for V2, bare ISO for V4).

**The entity set is what matters.** `/http/materialdocument` currently returns
`A_SerialNumberMaterialDocument` (serial numbers) instead of
`A_MaterialDocumentItem` (movement lines) — same service, wrong entity, and none
of the analytics fields are present. Please confirm the entity set below when
building each one.

---

## Build these two first — they unlock the most

### 1. Goods movements ⭐ highest value
`API_MATERIAL_DOCUMENT_SRV` → **`A_MaterialDocumentItem`** (V2)

| Field | Needed for |
|---|---|
| `Material` | which material moved |
| `Plant` | plant filter |
| `StorageLocation` | **slotting** (pick face vs reserve) |
| `QuantityInEntryUnit`, `EntryUnit` | movement size |
| `GoodsMovementType` | 101 receipt / 601 issue / 201 / 261 — direction |
| `PostingDate` | **required** for the 14–30 day trend window |
| `MaterialDocument`, `MaterialDocumentItem` | document identity |

**Unlocks:** demand trend & forecasting · days-of-cover in the health score ·
the stockout radar's demand side · slotting optimizer · movement-anomaly
detection · shift handover · ESG handling emissions.
*Suggested:* filter to the last 30 days by `PostingDate` inside the iFlow.

### 2. Purchase orders ⭐ (not in your list — please add)
`API_PURCHASEORDER_PROCESS_SRV` → **`A_PurchaseOrderItem`** (V2), expand
`to_PurchaseOrder` for header dates.

Fields: `PurchaseOrder`, `PurchaseOrderItem`, `Material`, `Plant`,
`OrderQuantity`, `PurchaseOrderQuantityUnit`, `Supplier`,
`ScheduleLineDeliveryDate` (or `DeliveryDate`), `CreationDate` (header), a
status/deletion field.

**Unlocks:** PO aging in the health score · "covered by inbound" in the stockout
radar · supplier scorecards with measured lead times · the PO-chase agent · ESG
transport emissions.

---

## Then, in value order

### 3. Physical inventory — `API_PHYSICAL_INVENTORY_DOC_SRV` → `A_PhysInventoryDocItem` (V2)
Counted vs book quantity. **Unlocks:** the cycle-count agent comparing real counts
against system stock, and count-variance reporting.

### 4. Warehouse physical stock by product — `API_WHSE_PHYSSTOCKPROD` (V4)
Stock at **storage-bin** granularity, finer than `StorageLocation`.
**Unlocks:** slotting at bin level instead of location level. Complements (does
not replace) Material Stock, which is already live.

### 5. Warehouse order & task — `API_WAREHOUSE_ORDER_TASK_2` (V4)
Real picking tasks. **Unlocks:** slotting driven by actual pick work rather than
inferred from movements — the strongest possible input for that agent.

### 6. Warehouse inbound / outbound delivery — `API_WHSE_INB_DELIVERY_2`, `API_WHSE_OUTB_DELIVERY_2` (V4)
Inbound complements PO coverage; outbound gives shipping-side demand.
Worth building **after** #1 and #2, which cover most of the same questions.

### 7. Handling Unit — `HANDLINGUNIT_0001` (V4 on Public Edition)
**No FactoryPilot feature consumes HU data today.** Build it only if you want an
HU/packing feature — say the word and I'll add the object and a card for it.

---

## Registering each one

1. Deploy the iFlow (same tenant, same OAuth2 service key, GET, XML or JSON).
2. **Connections → iFlow (read) → Connect**, set `fixedEndpoint = true` and put
   the entity set in *Test entity set* — that is what routes queries to it.
3. **Test** → expect "Reachable via iFlow (oauth2 auth) — N row(s)".
4. Tell me the endpoint and I register the business object + field mapping;
   the Insights cards switch to live automatically.

## One upgrade that pays for itself

Your endpoints return everything (2,745 stock rows, 9,056 serial rows) and
FactoryPilot filters client-side. If the iFlows accepted **`plant`** and **`top`**
and passed them into `$filter` / `$top`, payload, latency and token cost all drop
sharply — FactoryPilot already sends those parameters when `fixedEndpoint` is off.
