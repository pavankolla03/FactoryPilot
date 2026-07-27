import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type Scorecard = {
  supplierId: string | null;
  name: string;
  country: string | null;
  onTimeRatePct: number | null;
  leadTimeDays: number | null;
  promisedLeadDays: number | null;
  openPOs: number;
  overduePOs: number;
  qtyOnOrder: number;
  reliabilityScore: number | null;
  scoreUnavailableReason?: string | null;
  band: 'reliable' | 'watch' | 'at-risk' | null;
};

const BAND_CHIP: Record<NonNullable<Scorecard['band']>, string> = {
  reliable: 'bg-fp-good-soft text-fp-good',
  watch: 'bg-fp-warn-soft text-fp-warn',
  'at-risk': 'bg-fp-bad-soft text-fp-bad',
};

/**
 * Supplier intelligence (Phase Y): reliability scorecards ranked worst-first.
 * "Explain" hands the biggest-risk investigation to Otto in chat.
 */
export function SuppliersCard({
  client,
  onExplain,
}: {
  client: AxiosInstance;
  onExplain: () => void;
}) {
  const [rows, setRows] = useState<Scorecard[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/ops/suppliers');
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
          Supplier intelligence
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={onExplain}>
            Ask Otto: biggest risk?
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
            <Icon path={paths.history} size={12} strokeWidth={2.2} />
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        On-time rate, lead time and open-PO exposure per supplier — reliability score, worst first, so buyers and
        the PO-chase agent can prioritize the real risks.
      </p>

      {!rows && loading && <div className="py-4 text-center text-xs text-fp-ink-3">Scoring suppliers…</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fp-line text-left text-fp-ink-3">
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Reliability</th>
              <th className="px-3 py-2">On-time</th>
              <th className="px-3 py-2">Lead time</th>
              <th className="px-3 py-2">Open POs</th>
              <th className="px-3 py-2">On order</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((s) => (
              <tr key={s.name} className="border-b border-fp-line last:border-0 text-fp-ink">
                <td className="px-3 py-2">
                  <div className="font-semibold text-fp-ink">{s.name}</div>
                  <div className="text-[10px] text-fp-ink-3">
                    {s.country ?? '—'}
                    {s.supplierId ? ` · ${s.supplierId}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {s.reliabilityScore === null || s.band === null ? (
                    <span className="chip bg-fp-surface-2 text-fp-ink-3" title={s.scoreUnavailableReason ?? undefined}>
                      not scored
                    </span>
                  ) : (
                    <span className={`chip ${BAND_CHIP[s.band]}`}>
                      {s.reliabilityScore} · {s.band}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{s.onTimeRatePct !== null ? `${s.onTimeRatePct}%` : '—'}</td>
                <td className="px-3 py-2 tabular-nums">
                  {s.leadTimeDays !== null ? `${s.leadTimeDays}d` : '—'}
                  {s.promisedLeadDays !== null && s.promisedLeadDays !== s.leadTimeDays && (
                    <span className="text-fp-ink-3"> ({s.promisedLeadDays}d PO)</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {s.openPOs}
                  {s.overduePOs > 0 && <span className="ml-1 font-semibold text-fp-bad">· {s.overduePOs} overdue</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{s.qtyOnOrder ? s.qtyOnOrder.toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
