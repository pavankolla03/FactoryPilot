import { describe, expect, it } from 'vitest';
import { holtForecast, reorderPoint, toDailySeries } from './forecast';

describe('forecast math', () => {
  it('flat demand forecasts near the mean with ~zero trend', () => {
    const f = holtForecast([10, 10, 10, 10, 10, 10, 10], 14);
    expect(f.dailyDemand).toBeGreaterThan(9);
    expect(f.dailyDemand).toBeLessThan(11);
    expect(Math.abs(f.trendPerDay)).toBeLessThan(0.5);
    expect(f.horizonDemand).toBeGreaterThan(120);
    expect(f.horizonDemand).toBeLessThan(160);
  });

  it('rising demand yields a positive trend and larger horizon total', () => {
    const rising = holtForecast([4, 6, 8, 10, 12, 14, 16], 14);
    const flat = holtForecast([10, 10, 10, 10, 10, 10, 10], 14);
    expect(rising.trendPerDay).toBeGreaterThan(0.5);
    expect(rising.horizonDemand).toBeGreaterThan(flat.horizonDemand);
  });

  it('empty series forecasts zero without NaN', () => {
    const f = holtForecast([], 14);
    expect(f.dailyDemand).toBe(0);
    expect(f.horizonDemand).toBe(0);
    expect(f.mapePct).toBeNull();
  });

  it('reorder point grows with variability and lead time', () => {
    const calm = holtForecast([10, 10, 10, 10, 10, 10, 10], 14);
    const wild = holtForecast([2, 20, 1, 25, 3, 18, 2], 14);
    const calmRp = reorderPoint(calm, 10);
    const wildRp = reorderPoint(wild, 10);
    expect(wildRp.safetyStock).toBeGreaterThan(calmRp.safetyStock);
    expect(reorderPoint(calm, 20).reorderPoint).toBeGreaterThan(calmRp.reorderPoint);
  });

  it('toDailySeries buckets by date and zero-fills missing days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const series = toDailySeries([{ date: today, qty: 7 }, { date: today, qty: 3 }], 5);
    expect(series).toHaveLength(5);
    expect(series[4]).toBe(10);
    expect(series.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });
});
