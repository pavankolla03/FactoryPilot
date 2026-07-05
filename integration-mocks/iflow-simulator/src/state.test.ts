import { describe, expect, it } from 'vitest';
import { IflowState } from './state';

describe('IflowState moveStock', () => {
  it('moves stock from source to destination', () => {
    const state = new IflowState();

    const beforePackingQty =
      state.getStock('MAT-10023456', '1010').find((s) => s.location === 'packing')?.quantity ?? 0;
    const beforeShippingQty =
      state.getStock('MAT-10023456', '1010').find((s) => s.location === 'shipping')?.quantity ?? 0;

    const movement = state.moveStock({
      productId: 'P123',
      warehouseId: '1010',
      fromLocation: 'packing',
      toLocation: 'shipping',
      qty: 5,
    });

    const afterPacking = state.getStock('MAT-10023456', '1010').find((s) => s.location === 'packing');
    const afterShipping = state.getStock('MAT-10023456', '1010').find((s) => s.location === 'shipping');

    expect(movement.status).toBe('confirmed');
    expect(afterPacking?.quantity).toBe(beforePackingQty - 5);
    expect(afterShipping?.quantity).toBe(beforeShippingQty + 5);
  });

  it('rejects insufficient stock and never goes negative', () => {
    const state = new IflowState();

    expect(() =>
      state.moveStock({
        productId: 'P123',
        warehouseId: '1010',
        fromLocation: 'packing',
        toLocation: 'shipping',
        qty: 999999,
      }),
    ).toThrowError(/INSUFFICIENT_STOCK/);

    const packing = state.getStock('MAT-10023456', '1010').find((s) => s.location === 'packing');
    expect((packing?.quantity ?? 0) >= 0).toBe(true);
  });
});
