import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type Observability = {
  dependencies: Record<string, { ok: boolean; ms: number }>;
  runs: { avgMs: number; p95Ms: number };
  cacheHitRate: number | null;
  models: Array<{ model_used: string; calls: number; tokens: number; qualityPct: number | null }>;
};

/** Ops command center (beta, Phase L): live platform health for admins. */
export function CommandCenter({ client }: { client: AxiosInstance }) {
  const [data, setData] = useState<Observability | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/agents/admin/observability');
      setData(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error || !data) {
    return null;
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Command center
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
          <Icon path={paths.history} size={12} strokeWidth={2.2} />
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(data.dependencies).map(([name, dep]) => (
          <span
            key={name}
            className={`chip ${dep.ok ? 'bg-fp-good-soft text-fp-good' : 'bg-fp-bad-soft text-fp-bad'}`}
          >
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${dep.ok ? 'bg-fp-good' : 'bg-fp-bad'}`} />
            {name} {dep.ms >= 0 ? `${dep.ms}ms` : 'down'}
          </span>
        ))}
        <span className="chip bg-fp-bg text-fp-ink-2">agent runs avg {Math.round(data.runs.avgMs)}ms · p95 {Math.round(data.runs.p95Ms)}ms</span>
        {data.cacheHitRate !== null && <span className="chip bg-fp-bg text-fp-ink-2">cache hits {data.cacheHitRate}%</span>}
      </div>

      {data.models.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-fp-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-fp-bg text-left text-fp-ink-3">
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Calls</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Measured quality</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m.model_used} className="border-t border-fp-line text-fp-ink">
                  <td className="max-w-[240px] truncate px-3 py-1.5 font-medium">{m.model_used}</td>
                  <td className="px-3 py-1.5">{m.calls}</td>
                  <td className="px-3 py-1.5">{m.tokens?.toLocaleString?.() ?? m.tokens}</td>
                  <td className="px-3 py-1.5">
                    {m.qualityPct === null ? (
                      <span className="text-fp-ink-3">collecting…</span>
                    ) : (
                      <span className={m.qualityPct >= 80 ? 'font-semibold text-fp-good' : m.qualityPct >= 50 ? 'text-fp-warn' : 'text-fp-bad'}>
                        {m.qualityPct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-fp-ink-3">
        Measured quality = share of answers that grounded in live data or completed cleanly. The router prefers
        better-measuring models automatically (beta).
      </p>
    </section>
  );
}
