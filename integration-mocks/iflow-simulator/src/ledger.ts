import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MovementRecord, PurchaseRequisition, StockRecord } from './types';

/**
 * The write ledger for live-SAP mode. SAP's public sandbox is read-only, so
 * writes execute here: each confirmed movement is appended and applied as a
 * delta on top of live SAP reads. Persisted to disk so it survives restarts.
 * Swapping in a real S/4 tenant later replaces this with real OData writes.
 */
export class WriteLedger {
  private readonly file: string;
  movements: MovementRecord[] = [];
  purchaseRequisitions: PurchaseRequisition[] = [];
  receivedPOs: string[] = [];

  constructor(dataDir = process.env.LEDGER_DIR || path.join(process.cwd(), 'data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'ledger.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as
        | MovementRecord[]
        | { movements?: MovementRecord[]; purchaseRequisitions?: PurchaseRequisition[]; receivedPOs?: string[] };
      if (Array.isArray(parsed)) {
        this.movements = parsed;
      } else {
        this.movements = parsed.movements || [];
        this.purchaseRequisitions = parsed.purchaseRequisitions || [];
        this.receivedPOs = parsed.receivedPOs || [];
      }
    } catch {
      this.movements = [];
    }
  }

  private save() {
    fs.writeFileSync(
      this.file,
      JSON.stringify(
        {
          movements: this.movements,
          purchaseRequisitions: this.purchaseRequisitions,
          receivedPOs: this.receivedPOs,
        },
        null,
        2,
      ),
    );
  }

  receivePurchaseOrder(po: { poNumber: string; productId: string; materialId: string; warehouseId: string; qty: number }) {
    if (this.receivedPOs.includes(po.poNumber)) {
      throw new Error(`ALREADY_RECEIVED: purchase order ${po.poNumber} was already received`);
    }
    const movement: MovementRecord = {
      movementId: `MOV-${randomUUID().slice(0, 8)}`,
      productId: po.productId || po.materialId,
      warehouseId: po.warehouseId,
      fromLocation: 'inbound',
      toLocation: 'receiving',
      qty: po.qty,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };
    this.movements.unshift(movement);
    this.receivedPOs.push(po.poNumber);
    this.save();
    return { purchaseOrder: { ...po, status: 'delivered' }, movement };
  }

  adjustStock(
    liveRecords: StockRecord[],
    args: { productId: string; warehouseId: string; location: string; targetQty: number },
  ) {
    const adjusted = this.applyDeltas(liveRecords);
    const record = adjusted.find(
      (r) =>
        (r.productId === args.productId || r.materialId === args.productId) &&
        r.warehouseId === args.warehouseId &&
        r.location.toLowerCase() === args.location.toLowerCase(),
    );
    const previousQty = record?.quantity ?? 0;
    const delta = args.targetQty - previousQty;

    const movement: MovementRecord = {
      movementId: `MOV-${randomUUID().slice(0, 8)}`,
      productId: args.productId,
      warehouseId: args.warehouseId,
      fromLocation: delta >= 0 ? 'cycle-count' : args.location,
      toLocation: delta >= 0 ? args.location : 'cycle-count',
      qty: Math.abs(delta),
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };
    if (delta !== 0) {
      this.movements.unshift(movement);
      this.save();
    }

    return { previousQty, newQty: args.targetQty, delta, movement: delta !== 0 ? movement : null };
  }

  createPurchaseRequisition(args: { materialId: string; warehouseId: string; qty: number; note?: string }) {
    const pr: PurchaseRequisition = {
      prNumber: `PR-${String(Math.floor(Math.random() * 900000) + 100000)}`,
      materialId: args.materialId,
      warehouseId: args.warehouseId,
      qty: args.qty,
      note: args.note || '',
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    this.purchaseRequisitions.unshift(pr);
    this.save();
    return pr;
  }

  getDemandTrend(warehouseId: string, days: number) {
    const minTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const byDay = new Map<string, { moves: number; totalQty: number }>();
    for (const m of this.movements) {
      if (m.warehouseId !== warehouseId || new Date(m.timestamp).getTime() < minTime) {
        continue;
      }
      const day = m.timestamp.slice(0, 10);
      const entry = byDay.get(day) || { moves: 0, totalQty: 0 };
      entry.moves += 1;
      entry.totalQty += m.qty;
      byDay.set(day, entry);
    }
    return [...byDay.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  /** Applies all ledger movements as deltas onto live stock records. */
  applyDeltas(records: StockRecord[]): StockRecord[] {
    const result = records.map((r) => ({ ...r }));

    for (const move of [...this.movements].reverse()) {
      const source = result.find(
        (r) =>
          (r.productId === move.productId || r.materialId === move.productId) &&
          r.warehouseId === move.warehouseId &&
          r.location.toLowerCase() === move.fromLocation.toLowerCase(),
      );
      if (source) {
        source.quantity -= move.qty;
      }

      // Synthetic endpoints (goods receipt inflow, cycle-count writeoffs) must
      // never materialize as real storage locations.
      if (['cycle-count', 'inbound'].includes(move.toLocation.toLowerCase())) {
        continue;
      }

      const sample = source || result.find((r) => r.productId === move.productId || r.materialId === move.productId);
      let destination = result.find(
        (r) =>
          (r.productId === move.productId || r.materialId === move.productId) &&
          r.warehouseId === move.warehouseId &&
          r.location.toLowerCase() === move.toLocation.toLowerCase(),
      );
      if (!destination && sample) {
        destination = {
          materialId: sample.materialId,
          productId: sample.productId,
          warehouseId: move.warehouseId,
          location: move.toLocation,
          quantity: 0,
        };
        result.push(destination);
      }
      if (destination) {
        destination.quantity += move.qty;
      }
    }

    return result;
  }

  moveStock(
    liveRecords: StockRecord[],
    args: { productId: string; fromLocation: string; toLocation: string; qty: number; warehouseId: string },
  ): MovementRecord {
    const adjusted = this.applyDeltas(liveRecords);
    const source = adjusted.find(
      (r) =>
        (r.productId === args.productId || r.materialId === args.productId) &&
        r.warehouseId === args.warehouseId &&
        r.location.toLowerCase() === args.fromLocation.toLowerCase(),
    );

    if (!source || source.quantity < args.qty) {
      const available = source?.quantity ?? 0;
      throw new Error(`INSUFFICIENT_STOCK: only ${available} available at ${args.fromLocation}`);
    }

    const movement: MovementRecord = {
      movementId: `MOV-${randomUUID().slice(0, 8)}`,
      productId: args.productId,
      warehouseId: args.warehouseId,
      fromLocation: args.fromLocation,
      toLocation: args.toLocation,
      qty: args.qty,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    this.movements.unshift(movement);
    this.save();
    return movement;
  }

  getMovements(warehouseId: string, sinceHours: number): MovementRecord[] {
    const minTime = Date.now() - sinceHours * 60 * 60 * 1000;
    return this.movements.filter(
      (m) => m.warehouseId === warehouseId && new Date(m.timestamp).getTime() >= minTime,
    );
  }
}
