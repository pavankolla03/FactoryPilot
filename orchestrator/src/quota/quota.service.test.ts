import { describe, expect, it } from 'vitest';

describe('quota logic', () => {
  it('compares sum(total_tokens) against monthly limit', () => {
    const rows = [1000, 2500, 500];
    const sum = rows.reduce((acc, value) => acc + value, 0);
    const monthlyLimit = 5000;
    expect(sum >= monthlyLimit).toBe(false);
    expect(sum).toBe(4000);
  });
});
