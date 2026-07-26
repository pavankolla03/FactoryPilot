# Write-back iFlow contract (Phase AH)

Optional. Register a **write** iFlow and FactoryPilot posts approved actions to
SAP instead of the local ledger. Governance is unchanged — the write is only sent
*after* scope, auto-approve policy, anomaly detection and maker-checker have all
passed.

## Endpoint

`POST <your write endpoint>` — same tenant and OAuth2 service key as the read
iFlow. Register under **Connections → iFlow (write)**.

## Request FactoryPilot sends

```json
{ "operation": "moveStock",
  "warehouseId": "1010", "productId": "P123",
  "fromLocation": "packing", "toLocation": "shipping", "qty": 6 }
```

`operation` is one of:

| operation | SAP equivalent | Key fields |
|---|---|---|
| `moveStock` | transfer posting (mvt 311) | `warehouseId`, `productId`, `fromLocation`, `toLocation`, `qty` |
| `adjustStock` | physical inventory adjustment | `warehouseId`, `productId`, `location`, `targetQty`, `reason` |
| `receivePurchaseOrder` | goods receipt (mvt 101) | `poNumber`, `warehouseId` |
| `draftPurchaseRequisition` | create PR | `materialId`, `warehouseId`, `qty`, `note` |

## Response FactoryPilot expects

Return the document you created. Any of these field names is picked up
automatically:

```json
{ "success": true, "MaterialDocument": "4900000001", "MaterialDocumentYear": "2026" }
```

`MaterialDocument` · `PurchaseRequisition` · `PurchaseOrder` · `documentNumber`.
XML works too — the number is extracted either way.

## Failure behaviour (deliberate)

A non-2xx response **fails the action loudly**. FactoryPilot does *not* silently
fall back to the local ledger, because an operator would otherwise believe a
write reached SAP when it did not.

## Test button

Testing a write connection sends an `OPTIONS` request only — it verifies
reachability and credentials **without posting a document**.

## Verified

Against a stand-in endpoint: an approved move posted `moveStock` and recorded SAP
document `4900000001` with provenance `sap-iflow (live write)`; self-approval was
correctly blocked by maker-checker first, and a second approver was required.
