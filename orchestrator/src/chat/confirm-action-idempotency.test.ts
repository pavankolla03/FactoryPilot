import { describe, expect, it } from 'vitest';

describe('confirm action idempotency', () => {
  it('consumes action IDs exactly once (simulating Redis GETDEL)', () => {
    const store = new Map<string, string>();
    store.set('a1', 'payload');

    const first = (() => {
      const value = store.get('a1');
      if (value) {
        store.delete('a1');
      }
      return value;
    })();

    const second = (() => {
      const value = store.get('a1');
      if (value) {
        store.delete('a1');
      }
      return value;
    })();

    expect(first).toBe('payload');
    expect(second).toBeUndefined();
  });
});
