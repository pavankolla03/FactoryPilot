import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Material, MovementRecord, StockRecord } from './types';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function readFixture<T>(fileName: string): T {
  const filePath = path.join(fixturesDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export class IflowState {
  materials: Material[];
  stocks: StockRecord[];
  movements: MovementRecord[];

  constructor() {
    this.materials = readFixture<Material[]>('materials.json');
    this.stocks = readFixture<StockRecord[]>('stocks.json');
    this.movements = readFixture<MovementRecord[]>('movements.json');
  }

  getMaterial(materialId: string): Material | undefined {
    return this.materials.find((m) => m.materialId === materialId);
  }

  getStock(materialId?: string, warehouseId?: string): StockRecord[] {
    return this.stocks.filter((s) => {
      if (materialId && s.materialId !== materialId) {
        return false;
      }
      if (warehouseId && s.warehouseId !== warehouseId) {
        return false;
      }
      return true;
    });
  }

  getMovements(warehouseId: string, sinceHours: number): MovementRecord[] {
    const minTime = Date.now() - sinceHours * 60 * 60 * 1000;
    return this.movements.filter(
      (m) => m.warehouseId === warehouseId && new Date(m.timestamp).getTime() >= minTime,
    );
  }

  moveStock(args: {
    productId: string;
    fromLocation: string;
    toLocation: string;
    qty: number;
    warehouseId: string;
  }): MovementRecord {
    const { productId, fromLocation, toLocation, qty, warehouseId } = args;

    const source = this.stocks.find(
      (s) =>
        s.productId === productId &&
        s.warehouseId === warehouseId &&
        s.location.toLowerCase() === fromLocation.toLowerCase(),
    );

    if (!source || source.quantity < qty) {
      const available = source?.quantity ?? 0;
      throw new Error(`INSUFFICIENT_STOCK: only ${available} available at ${fromLocation}`);
    }

    let destination = this.stocks.find(
      (s) =>
        s.productId === productId &&
        s.warehouseId === warehouseId &&
        s.location.toLowerCase() === toLocation.toLowerCase(),
    );

    if (!destination) {
      destination = {
        materialId: source.materialId,
        productId,
        warehouseId,
        location: toLocation,
        quantity: 0,
      };
      this.stocks.push(destination);
    }

    source.quantity -= qty;
    destination.quantity += qty;

    const movement: MovementRecord = {
      movementId: `MOV-${randomUUID().slice(0, 8)}`,
      productId,
      warehouseId,
      fromLocation,
      toLocation,
      qty,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    this.movements.unshift(movement);
    return movement;
  }
}
