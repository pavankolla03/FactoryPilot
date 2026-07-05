import { describe, expect, it } from 'vitest';
import { movementCacheKey, movementScoreWindow } from './movements-cache.js';

describe('movements cache helper', () => {
  it('builds the expected sorted-set key', () => {
    expect(movementCacheKey('1010')).toBe('cache:movements:1010');
  });

  it('builds score windows for ZRANGEBYSCORE', () => {
    const now = 1_000_000;
    const { min, max } = movementScoreWindow(1, now);
    expect(max).toBe(now);
    expect(min).toBe(now - 3_600_000);
  });
});
