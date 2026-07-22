import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type Risk = {
  warehouseId: string;
  materialId: string;
  onHand: number;
  dailyDemand: number;
  daysToStockout: number;
  inboundQty: number;
  covered: boolean;
  supplier: string | null;
  leadTimeDays: number;
  recommendedOrderQty: number;
  severity: 'critical' | 'high' | 'watch';
};
type RadarData = { risks: Risk[]; summary: { critical: number; high: number; uncovered: number } };

const SEV_TEXT: Record<Risk['severity'], string> = {
  critical: 'text-fp-bad',
  high: 'text-fp-warn',
  watch: 'text-fp-ink-2',
};
const SEV_CHIP: Record<Risk['severity'], string> = {
  critical: 'bg-fp-bad-soft text-fp-bad',
  high: 'bg-fp-warn-soft text-fp-warn',
  watch: 'bg-fp-bg text-fp-ink-3',
};

/**
 * Predictive Stockout Radar (Phase AB): materials ranked by days-to-stockout,
 * with covered-by-inbound detection and a governed reorder handoff.
 */
export function StockoutRadarCard({
  client,
  onReorder,
}: {
  client: AxiosInstance;
  onReorder: (warehouseId: string, materialId: string, qty: number) => void;
}) {
  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/ops/stockout-radar');
      setData(res.data);
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

  const s = data?.summary;

  return (
    <section className="card mb-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Predictive stockout radar
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
          <Icon path={paths.history} size={12} strokeWidth={2.2} />
          {loading ? '…' : 'Refresh'}
        </button>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Materials ranked by forecast days-to-stockout, uncovered first. Critical uncovered risks also raise a proactive
        alert.
      </p>

      {s && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="chip bg-fp-bad-soft text-fp-bad">{s.critical} critical</span>
          <span className="chip bg-fp-warn-soft text-fp-warn">{s.high} high</span>
          <span className="chip bg-fp-bg text-fp-ink-2">{s.uncovered} uncovered</span>
        </div>
      )}

      {data && data.risks.length === 0 && (
        <div className="py-6 text-center text-xs text-fp-ink-3">
          No materials are projected to stock out within 30 days.
        </div>
      )}

      <div className="space-y-2">
        {(data?.risks ?? []).slice(0, 10).map((r) => (
          <div
            key={`${r.warehouseId}-${r.materialId}`}
            className="flex items-center gap-3 rounded-xl border border-fp-line bg-fp-bg px-3.5 py-2.5"
          >
            <div className="w-16 shrink-0 text-center">
              <div className={`text-[22px] font-bold leading-none ${SEV_TEXT[r.severity]}`}>{r.daysToStockout}</div>
              <div className="text-[9px] uppercase tracking-wider text-fp-ink-3">days</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fp-ink">
                {r.materialId}
                <span className="text-fp-ink-3">WH {r.warehouseId}</span>
                <span className={`chip ${SEV_CHIP[r.severity]}`}>{r.severity}</span>
                {r.covered && <span className="chip bg-fp-good-soft text-fp-good">inbound covers</span>}
              </div>
              <div className="text-[11px] text-fp-ink-3">
                {r.onHand} on hand · {r.dailyDemand}/day
                {r.covered
                  ? ` · ${r.inboundQty} inbound arriving in time`
                  : `; reorder ${r.recommendedOrderQty}${r.supplier ? ` from ${r.supplier} (lead ${r.leadTimeDays}d)` : ''}`}
              </div>
            </div>
            {!r.covered && r.recommendedOrderQty > 0 && (
              <button
                className="shrink-0 rounded-lg bg-fp-navy px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-fp-accent-dark"
                onClick={() => onReorder(r.warehouseId, r.materialId, r.recommendedOrderQty)}
              >
                Reorder
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
