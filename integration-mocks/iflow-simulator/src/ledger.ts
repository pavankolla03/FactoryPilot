import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MovementRecord, StockRecord } from './types';

/**
 * The write ledger for live-SAP mode. SAP's public sandbox is read-only, so
 * writes execute here: each confirmed movement is appended and applied as a
 * delta on top of live SAP reads. Persisted to disk so it survives restarts.
 * Swapping in a real S/4 tenant later replaces this with real OData writes.
 */
export class WriteLedger {
  private readonly file: string;
  movements: MovementRecord[] = [];

  constructor(dataDir = process.env.LEDGER_DIR || path.join(process.cwd(), 'data')) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'ledger.json');
    try {
      this.movements = JSON.parse(fs.readFileSync(this.file, 'utf8')) as MovementRecord[];
    } catch {
      this.movements = [];
    }
  }

  private save() {
    fs.writeFileSync(this.file, JSON.stringify(this.movements, null, 2));
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
