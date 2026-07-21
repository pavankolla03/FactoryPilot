/**
 * Mock OData entity sets for the Business Object registry (Phase U/V). Each entry
 * mirrors the shape of the real S/4HANA API for that object so the generic
 * `/iflow/odata` passthrough returns the same field names live or simulated.
 *
 * Dates are generated relative to "now" so "today" queries always have data.
 */

const WAREHOUSES = ['1010', '1020', '1030', '1040', '1050'];

function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CUSTOMERS = ['Rheinwerk Metallbau GmbH', 'CuTech Windings Ltd', 'Nordic Drives AS', 'Batra Components'];
const CARRIERS = ['DHL Freight', 'DB Schenker', 'Kuehne+Nagel', 'DSV'];
const ROUTES = ['R-NORTH', 'R-SOUTH', 'R-EXPORT', 'R-LOCAL'];
const SUPPLIERS = ['SUP-1001', 'SUP-1002', 'SUP-1003'];
const MATERIALS = ['MAT-10023456', 'MAT-10023458', 'MAT-10023459', 'MAT-10023464', 'MAT-10023465'];

type Row = Record<string, unknown>;

function buildSalesOrders(): Row[] {
  const rows: Row[] = [];
  let n = 4500;
  // A handful due today per warehouse, plus a spread across the week.
  for (const wh of WAREHOUSES) {
    const dueOffsets = [0, 0, 0, 1, 2, -1, 3];
    dueOffsets.forEach((off, i) => {
      n += 1;
      const status = off < 0 ? 'C' : i % 3 === 0 ? 'B' : 'A'; // C=complete, B=in process, A=not started
      rows.push({
        SalesOrder: String(30000000 + n),
        SoldToPartyName: CUSTOMERS[(n + i) % CUSTOMERS.length],
        Plant: wh,
        OverallStatus: status,
        RequestedDeliveryDate: dayOffset(off),
        TotalNetAmount: 1000 + ((n * 37) % 9000),
      });
    });
  }
  return rows;
}

function buildDeliveries(): Row[] {
  const rows: Row[] = [];
  let n = 800;
  for (const wh of WAREHOUSES) {
    const offsets = [0, 0, 1, -1, 2];
    offsets.forEach((off, i) => {
      n += 1;
      const shipped = off < 0;
      rows.push({
        DeliveryDocument: String(80000000 + n),
        Warehouse: wh,
        Route: ROUTES[(n + i) % ROUTES.length],
        Carrier: CARRIERS[(n + i) % CARRIERS.length],
        GoodsMovementStatus: shipped ? 'C' : 'A', // C=goods issued, A=not started
        ShippingStatus: shipped ? 'shipped' : 'pending',
        PlannedGoodsIssueDate: dayOffset(off),
      });
    });
  }
  return rows;
}

function buildGoodsMovements(): Row[] {
  const rows: Row[] = [];
  let n = 4900;
  const types = ['101', '601', '101', '201', '601', '261']; // receipt / issue / consumption
  for (const wh of WAREHOUSES) {
    types.forEach((t, i) => {
      n += 1;
      rows.push({
        MaterialDocument: String(49000000 + n),
        GoodsMovementType: t,
        Material: MATERIALS[(n + i) % MATERIALS.length],
        Plant: wh,
        QuantityInEntryUnit: 5 + ((n * 13) % 120),
        PostingDate: dayOffset(-(i % 3)), // today / yesterday / 2 days ago
      });
    });
  }
  return rows;
}

function buildPurchaseOrderItems(): Row[] {
  const rows: Row[] = [];
  let n = 4500;
  for (const wh of WAREHOUSES) {
    const offsets = [-2, 0, 3, 5]; // one overdue, one due today, two upcoming
    offsets.forEach((off, i) => {
      n += 1;
      const delivered = i === 3;
      rows.push({
        PurchaseOrder: String(4500012000 + n),
        Material: MATERIALS[(n + i) % MATERIALS.length],
        Plant: wh,
        OrderQuantity: 50 + ((n * 7) % 500),
        DeliveryStatus: delivered ? 'delivered' : 'open',
        Supplier: SUPPLIERS[(n + i) % SUPPLIERS.length],
        DeliveryDate: dayOffset(off),
      });
    });
  }
  return rows;
}

// Keyed by entity set name (matches business_objects.entity_set).
export const ODATA_FIXTURES: Record<string, Row[]> = {
  A_SalesOrder: buildSalesOrders(),
  A_OutboundDelivery: buildDeliveries(),
  A_MaterialDocumentItem: buildGoodsMovements(),
  A_PurchaseOrderItem: buildPurchaseOrderItems(),
};

export function knownEntitySet(entitySet: string): boolean {
  return Object.prototype.hasOwnProperty.call(ODATA_FIXTURES, entitySet);
}

/** Parse a minimal OData $filter: `Field eq 'value'` clauses joined by ` and `. */
function matchesFilter(row: Row, filter?: string): boolean {
  if (!filter) {
    return true;
  }
  const clauses = filter.split(/\s+and\s+/i);
  return clauses.every((clause) => {
    const m = /^\s*([A-Za-z0-9_]+)\s+eq\s+(.+?)\s*$/.exec(clause);
    if (!m) {
      return true; // unsupported clause — don't exclude
    }
    const field = m[1];
    let value = m[2].trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    return String(row[field] ?? '') === value;
  });
}

/** Generic query over a fixture entity set: $filter (eq/and), $select, $top. */
export function queryFixture(
  entitySet: string,
  opts: { filter?: string; select?: string; top?: number },
): Row[] {
  const all = ODATA_FIXTURES[entitySet] || [];
  let rows = all.filter((r) => matchesFilter(r, opts.filter));
  if (opts.select) {
    const cols = opts.select.split(',').map((c) => c.trim()).filter(Boolean);
    rows = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  }
  if (opts.top && opts.top > 0) {
    rows = rows.slice(0, opts.top);
  }
  return rows;
}
