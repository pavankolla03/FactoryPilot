import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type Factor = { key: string; label: string; score: number; weight: number; detail: string };
type Health = {
  warehouseId: string;
  score: number;
  band: 'healthy' | 'watch' | 'critical';
  trend: number | null;
  detractor: { label: string; score: number; detail: string } | null;
  factors: Factor[];
  computedAt: string;
};

const BAND_TEXT: Record<Health['band'], string> = {
  healthy: 'text-fp-good',
  watch: 'text-fp-warn',
  critical: 'text-fp-bad',
};
const BAND_RING: Record<Health['band'], string> = {
  healthy: 'border-fp-good/40 bg-fp-good-soft',
  watch: 'border-fp-warn/40 bg-fp-warn-soft',
  critical: 'border-fp-bad/40 bg-fp-bad-soft',
};

/**
 * Warehouse Health Score (Phase X): one 0-100 judgment per warehouse with trend
 * and the biggest detractor. "Explain" hands the investigation to Otto in chat.
 */
export function WarehouseHealthCard({
  client,
  onExplain,
}: {
  client: AxiosInstance;
  onExplain: (warehouseId: string) => void;
}) {
  const [rows, setRows] = useState<Health[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/ops/health');
      setRows(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return null;
  }

  return (
    <section className="card mb-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Warehouse health
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
          <Icon path={paths.history} size={12} strokeWidth={2.2} />
          {loading ? 'Scoring…' : 'Refresh'}
        </button>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        A composite score from days-of-cover, low stock, PO aging and movement anomalies — worst warehouse first. Click
        Explain to have Otto investigate.
      </p>

      {!rows && loading && <div className="py-4 text-center text-xs text-fp-ink-3">Scoring warehouses…</div>}
      {rows && rows.length === 0 && (
        <div className="py-4 text-center text-xs text-fp-ink-3">No warehouses in your scope.</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(rows ?? []).map((h) => (
          <div key={h.warehouseId} className={`rounded-2xl border p-4 ${BAND_RING[h.band]}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
                  Warehouse {h.warehouseId}
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className={`text-[30px] font-bold leading-none ${BAND_TEXT[h.band]}`}>{h.score}</span>
                  <span className={`text-xs font-semibold capitalize ${BAND_TEXT[h.band]}`}>{h.band}</span>
                </div>
              </div>
              {h.trend !== null && h.trend !== 0 && (
                <span
                  className={`chip text-[11px] ${h.trend > 0 ? 'bg-fp-good-soft text-fp-good' : 'bg-fp-bad-soft text-fp-bad'}`}
                >
                  {h.trend > 0 ? '▲' : '▼'} {Math.abs(h.trend)}
                </span>
              )}
            </div>

            <div className="mt-2 min-h-[2.4em] text-[12px] text-fp-ink-2">
              {h.detractor ? (
                <>
                  <span className="font-semibold text-fp-ink">{h.detractor.label}:</span> {h.detractor.detail}
                </>
              ) : (
                <span className="text-fp-good">All factors healthy.</span>
              )}
            </div>

            {openId === h.warehouseId && (
              <div className="mt-2 space-y-1 border-t border-fp-line pt-2">
                {h.factors.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-[11px]">
                    <span className="w-28 shrink-0 text-fp-ink-3">{f.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fp-line">
                      <span
                        className={`block h-full rounded-full ${f.score >= 80 ? 'bg-fp-good' : f.score >= 60 ? 'bg-[#EDA100]' : 'bg-fp-bad'}`}
                        style={{ width: `${f.score}%` }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right font-semibold tabular-nums text-fp-ink-2">{f.score}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                className="rounded-lg bg-fp-navy px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-fp-accent-dark"
                onClick={() => onExplain(h.warehouseId)}
              >
                Explain
              </button>
              <button
                className="btn-ghost px-2.5 py-1.5 text-[11px]"
                onClick={() => setOpenId(openId === h.warehouseId ? null : h.warehouseId)}
              >
                {openId === h.warehouseId ? 'Hide factors' : 'Factors'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
