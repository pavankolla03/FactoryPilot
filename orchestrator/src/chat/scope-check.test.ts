import { describe, expect, it } from 'vitest';

function canAccessTool(
  userRole: 'admin' | 'viewer',
  userScopes: string[],
  toolSchema: Record<string, unknown>,
  args: Record<string, unknown>,
) {
  const requiresWarehouse = toolSchema.warehouseId !== undefined;
  if (!requiresWarehouse) {
    return true;
  }
  if (userRole === 'admin') {
    return true;
  }
  return typeof args.warehouseId === 'string' && userScopes.includes(args.warehouseId);
}

describe('scope check middleware semantics', () => {
  it('allows tools with no warehouseId for all authenticated users', () => {
    expect(canAccessTool('viewer', [], { materialId: 'string' }, { materialId: 'MAT-1' })).toBe(true);
  });

  it('blocks warehouse tools outside viewer scope', () => {
    expect(canAccessTool('viewer', ['1010'], { warehouseId: 'string' }, { warehouseId: '9999' })).toBe(false);
  });

  it('allows warehouse tools for admin', () => {
    expect(canAccessTool('admin', [], { warehouseId: 'string' }, { warehouseId: '9999' })).toBe(true);
  });
});
