import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

function sortObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sortObject(item));
  }

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }

  return input;
}

function sortedHash(params: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(sortObject(params))).digest('hex');
}

describe('sortedHash', () => {
  it('is stable regardless of object key order', () => {
    const a = sortedHash({ warehouseId: '1010', materialId: 'MAT-10023456' });
    const b = sortedHash({ materialId: 'MAT-10023456', warehouseId: '1010' });
    expect(a).toBe(b);
  });
});
