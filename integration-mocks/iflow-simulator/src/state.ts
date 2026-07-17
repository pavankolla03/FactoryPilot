import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Material, MovementRecord, PurchaseOrder, StockRecord } from './types';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function readFixture<T>(fileName: string): T {
  const filePath = path.join(fixturesDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export class IflowState {
  materials: Material[];
  stocks: StockRecord[];
  movements: MovementRecord[];
  purchaseOrders: PurchaseOrder[];

  constructor() {
    this.materials = readFixture<Material[]>('materials.json');
    this.stocks = readFixture<StockRecord[]>('stocks.json');
    this.movements = readFixture<MovementRecord[]>('movements.json');
    this.purchaseOrders = readFixture<PurchaseOrder[]>('purchase-orders.json');
  }

  searchMaterials(query: string): Array<Material & { totalStock: number }> {
    const q = query.toLowerCase();
    return this.materials
      .filter(
        (m) =>
          m.materialId.toLowerCase().includes(q) ||
          m.productId.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.materialType.toLowerCase() === q,
      )
      .map((m) => ({
        ...m,
        totalStock: this.stocks
          .filter((s) => s.materialId === m.materialId)
          .reduce((sum, s) => sum + s.quantity, 0),
      }));
  }

  getWarehouseSummary(warehouseId: string) {
    const stocks = this.stocks.filter((s) => s.warehouseId === warehouseId);
    const byLocation: Record<string, number> = {};
    for (const s of stocks) {
      byLocation[s.location] = (byLocation[s.location] || 0) + s.quantity;
    }
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
      warehouseId,
      distinctMaterials: new Set(stocks.map((s) => s.materialId)).size,
      totalQuantity: stocks.reduce((sum, s) => sum + s.quantity, 0),
      byLocation,
      movementsLast24h: this.movements.filter(
        (m) => m.warehouseId === warehouseId && new Date(m.timestamp).getTime() >= dayAgo,
      ).length,
      openPurchaseOrders: this.purchaseOrders.filter(
        (po) => po.warehouseId === warehouseId && po.status !== 'delivered',
      ).length,
    };
  }

  getLowStock(warehouseId: string, threshold: number) {
    return this.stocks
      .filter((s) => s.warehouseId === warehouseId && s.quantity < threshold)
      .map((s) => ({
        ...s,
        description: this.getMaterial(s.materialId)?.description ?? '',
        inboundQty: this.purchaseOrders
          .filter(
            (po) =>
              po.materialId === s.materialId && po.warehouseId === warehouseId && po.status !== 'delivered',
          )
          .reduce((sum, po) => sum + po.qty, 0),
      }))
      .sort((a, b) => a.quantity - b.quantity);
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

  getPurchaseOrders(warehouseId?: string, status?: string): PurchaseOrder[] {
    return this.purchaseOrders.filter((po) => {
      if (warehouseId && po.warehouseId !== warehouseId) {
        return false;
      }
      if (status && po.status !== status) {
        return false;
      }
      return true;
    });
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
