# Phase AN — three more live SAP objects

The customer deployed three further iFlows on the BTP trial tenant and repointed
an existing one. This phase wires them in and, where the SAP entity cannot answer
a question, makes the app say so instead of guessing.

| iFlow | Entity set served | Status |
|---|---|---|
| `/http/materialstockread` | `A_MatlStkInAcctMod` | live (Phase AF) |
| `/http/materialdocument` | `A_MaterialDocumentItem` | **repointed** — was serial numbers |
| `/http/physicalinventory` | `A_PhysInventoryDocItem` | **new** |
| `/http/purchaseorder` | `A_PurchaseOrder` (header) | **new** |

## What went live

**Goods movements** (`getRecentMovements`) now come from SAP material documents:
material, plant, storage location, movement type, quantity, and receipt/issue
direction derived from `DebitCreditCode`. This was the largest remaining
simulator hole.

**Physical inventory** is a new business object: count documents with book vs
counted quantity and posted variances, scoped by plant.

**Purchase orders** are live but header-only.

## Honesty constraints (the interesting part)

Two SAP entities cannot answer the question a user naturally asks, and the fix
was structural rather than a prompt note.

*Movements have no posting timestamp.* `A_MaterialDocumentItem` exposes fiscal
period but not posting date — that lives on the document header. So the
`sinceHours` window is **not** applied, and the payload says so. The model is
told explicitly not to describe the rows as "last 24 hours".

*Purchase order headers have no plant.* Asked for "open POs for warehouse 1030",
the model initially answered with a confident table titled *"Warehouse 1030 has
30 open purchase orders"* — inventing both the plant scoping and the "open"
status. A leading prose caveat did not stop it, and neither did a
`warehouseFilterApplied: false` field.

What worked was removing the rows: a plant-scoped PO request now returns
`unavailable: true` with a reason and no `records` array at all. Nothing to
tabulate means nothing to misattribute. The answer became:

> I can't list open purchase orders for warehouse 1030 because the connected SAP
> system only provides purchase order headers (without plant/warehouse
> assignment)… To fix this: connect an `A_PurchaseOrderItem` iFlow.

The general lesson, which applies to every future object: when the payload cannot
support the question, withhold the data, don't annotate it.

## Bugs found and fixed while testing

- **Stale answers survived a landscape change.** The chat dedupe cache keyed only
  on user + question, so answers cached *before* an iFlow was connected replayed
  afterwards — including the misleading PO answer above, which is why the first
  retest looked unchanged. The key now includes a fingerprint of the connections
  and object registry.
- **The row budget truncated the board.** Phase AM's 30-row cap applied to every
  consumer, so plant 1710's board rendered 30 of 352 cards. The budget now
  applies to model payloads only; UI surfaces pass `full`.
- **`PHYSICAL_INVENTORY` had no plant filter**, so plant-scoped answers silently
  covered every plant. **`PURCHASING` had `Plant eq '{warehouseId}'`** on an
  entity with no `Plant` field, which would have filtered everything out.
- **Container could not reach SAP after a Docker restart.** Docker's NAT64 hands
  out unreachable `64:ff9b::` addresses for the BTP hosts and Happy Eyeballs
  stalled the TLS handshake to timeout; TCP and DNS both looked healthy, which
  made it read as a dead tenant. Pinned to IPv4 in compose.

## New capability

`POST /api/admin/business-objects/:id/preview` returns a handful of real rows
plus the field names SAP actually returned. A fixed-endpoint iFlow often serves a
different entity set than the registry claims — this is how the material-document
repointing and the PO header/item mismatch were both caught.

## Still needed from the customer

- **`A_PurchaseOrderItem` iFlow** — unlocks plant-scoped POs, inbound quantities
  and supplier ETA per material. This is the highest-value remaining gap.
- A movement **header** feed (or `PostingDate` on the item projection) would make
  "movements in the last 24 hours" answerable.
