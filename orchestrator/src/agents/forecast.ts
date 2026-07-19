/**
 * Demand forecasting (beta, Phase I). Pure functions — no I/O — so the math
 * is unit-testable. Holt's linear exponential smoothing over a daily demand
 * series, plus classical safety-stock / reorder-point formulas. Deliberately
 * no vector DB, no ML runtime: time-series arithmetic is enough at this
 * granularity and keeps the product's "no RAG, no HANA" constraint intact.
 */

export interface ForecastResult {
  /** Smoothed demand per day at the end of the series. */
  dailyDemand: number;
  /** Per-day trend component (positive = demand growing). */
  trendPerDay: number;
  /** Forecast total demand over the horizon. */
  horizonDemand: number;
  /** Std deviation of the daily series (demand variability). */
  sigma: number;
  /** Mean absolute percentage error of one-step forecasts (quality signal). */
  mapePct: number | null;
}

/** Holt's linear method with fixed smoothing factors (alpha 0.4, beta 0.2). */
export function holtForecast(series: number[], horizonDays: number): ForecastResult {
  if (series.length === 0) {
    return { dailyDemand: 0, trendPerDay: 0, horizonDemand: 0, sigma: 0, mapePct: null };
  }
  const alpha = 0.4;
  const beta = 0.2;
  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  const absPctErrors: number[] = [];

  for (let i = 1; i < series.length; i += 1) {
    const forecast = level + trend;
    if (series[i] > 0) {
      absPctErrors.push(Math.abs((series[i] - forecast) / series[i]));
    }
    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const dailyDemand = Math.max(level, 0);
  const mean = series.reduce((s, v) => s + v, 0) / series.length;
  const sigma = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length);
  // Sum of level+trend projected forward, floored at zero per day.
  let horizonDemand = 0;
  for (let d = 1; d <= horizonDays; d += 1) {
    horizonDemand += Math.max(level + trend * d, 0);
  }

  return {
    dailyDemand: round2(dailyDemand),
    trendPerDay: round2(trend),
    horizonDemand: Math.round(horizonDemand),
    sigma: round2(sigma),
    mapePct: absPctErrors.length ? Math.round((absPctErrors.reduce((s, v) => s + v, 0) / absPctErrors.length) * 100) : null,
  };
}

/**
 * Safety stock at ~95% service level (z = 1.65): z * sigma * sqrt(leadTime).
 * Reorder point = expected demand over the lead time + safety stock.
 */
export function reorderPoint(f: ForecastResult, leadTimeDays: number): { safetyStock: number; reorderPoint: number } {
  const safetyStock = Math.ceil(1.65 * f.sigma * Math.sqrt(Math.max(leadTimeDays, 1)));
  const leadTimeDemand = f.dailyDemand * leadTimeDays;
  return { safetyStock, reorderPoint: Math.ceil(leadTimeDemand + safetyStock) };
}

/** Buckets raw movement/demand records into a contiguous daily series. */
export function toDailySeries(records: Array<{ date: string; qty: number }>, days: number): number[] {
  const byDay = new Map<string, number>();
  for (const r of records) {
    byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.qty);
  }
  const series: number[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    series.push(byDay.get(day) ?? 0);
  }
  return series;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
