export interface Material {
  materialId: string;
  productId: string;
  description: string;
  baseUom: string;
  materialType: string;
}

export interface StockRecord {
  materialId: string;
  productId: string;
  warehouseId: string;
  location: string;
  quantity: number;
}

export interface MovementRecord {
  movementId: string;
  productId: string;
  warehouseId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
  timestamp: string;
  status: 'confirmed';
}

export interface PurchaseOrder {
  poNumber: string;
  materialId: string;
  productId: string;
  warehouseId: string;
  qty: number;
  supplier: string;
  status: 'open' | 'in_transit' | 'delivered';
  orderedAt: string;
  expectedDelivery: string;
}

export interface ApiErrorShape {
  error: {
    code:
      | 'SCOPE_DENIED'
      | 'QUOTA_EXCEEDED'
      | 'ACTION_EXPIRED'
      | 'INSUFFICIENT_STOCK'
      | 'VALIDATION_ERROR';
    message: string;
  };
}
