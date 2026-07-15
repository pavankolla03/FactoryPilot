import { describe, expect, it } from 'vitest';
import type { WarehouseScope } from '../common/types';

function canAccessTool(
  userRole: 'admin' | 'viewer',
  userScopes: WarehouseScope[],
  toolSchema: Record<string, unknown>,
  args: Record<string, unknown>,
  need: 'read' | 'write' = 'read',
) {
  const requiresWarehouse = toolSchema.warehouseId !== undefined;
  if (!requiresWarehouse) {
    return true;
  }
  if (userRole === 'admin') {
    return true;
  }
  if (typeof args.warehouseId !== 'string') {
    return false;
  }
  const scope = userScopes.find((s) => s.warehouseId === args.warehouseId);
  if (!scope) {
    return false;
  }
  return need === 'read' || scope.accessLevel === 'write';
}

describe('scope check middleware semantics', () => {
  it('allows tools with no warehouseId for all authenticated users', () => {
    expect(canAccessTool('viewer', [], { materialId: 'string' }, { materialId: 'MAT-1' })).toBe(true);
  });

  it('blocks warehouse tools outside viewer scope', () => {
    expect(
      canAccessTool(
        'viewer',
        [{ warehouseId: '1010', accessLevel: 'read' }],
        { warehouseId: 'string' },
        { warehouseId: '9999' },
      ),
    ).toBe(false);
  });

  it('allows warehouse tools for admin', () => {
    expect(canAccessTool('admin', [], { warehouseId: 'string' }, { warehouseId: '9999' })).toBe(true);
  });

  it('blocks write tools for read-only scopes', () => {
    expect(
      canAccessTool(
        'viewer',
        [{ warehouseId: '1010', accessLevel: 'read' }],
        { warehouseId: 'string' },
        { warehouseId: '1010' },
        'write',
      ),
    ).toBe(false);
  });

  it('allows write tools for write scopes', () => {
    expect(
      canAccessTool(
        'viewer',
        [{ warehouseId: '1010', accessLevel: 'write' }],
        { warehouseId: 'string' },
        { warehouseId: '1010' },
        'write',
      ),
    ).toBe(true);
  });
});
