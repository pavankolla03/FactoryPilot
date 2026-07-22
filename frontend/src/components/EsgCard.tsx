import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type WarehouseEsg = {
  warehouseId: string;
  transportKg: number;
  handlingKg: number;
  totalKg: number;
  unitsMoved: number;
  intensityKgPerUnit: number;
};
type Report = {
  warehouses: WarehouseEsg[];
  summary: {
    totalKg: number;
    transportKg: number;
    handlingKg: number;
    intensityKgPerUnit: number;
    byMode: Array<{ mode: string; kg: number }>;
    topSuppliers: Array<{ supplier: string; kg: number; mode: string }>;
    dailyTrend: Array<{ day: string; kg: number }>;
  };
};

const MODE_COLOR: Record<string, string> = {
  road: '#2A78D6',
  sea: '#1B7F3B',
  air: '#D95926',
  rail: '#B87A00',
};

/** ESG / Sustainability (Phase AC): activity-based carbon footprint with breakdown + CSV. */
export function EsgCard({ client, onExport }: { client: AxiosInstance; onExport: () => void }) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/ops/esg');
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
  const transportPct = s && s.totalKg > 0 ? Math.round((s.transportKg / s.totalKg) * 100) : 0;

  return (
    <section className="card mb-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Sustainability (carbon)
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={onExport}>
            <Icon path={paths.download} size={12} strokeWidth={2.2} />
            Export CSV
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
            <Icon path={paths.history} size={12} strokeWidth={2.2} />
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Estimated CO₂e from inbound transport (supplier distance × freight mode) and warehouse handling — from data
        already flowing. Factors are illustrative; a deployment plugs in your own.
      </p>

      {s && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Total CO₂e" value={`${(s.totalKg / 1000).toFixed(1)} t`} note={`${s.totalKg.toLocaleString()} kg`} />
            <Tile label="Transport" value={`${transportPct}%`} note={`${s.transportKg.toLocaleString()} kg`} />
            <Tile label="Handling" value={`${100 - transportPct}%`} note={`${s.handlingKg.toLocaleString()} kg`} />
            <Tile label="Intensity" value={`${s.intensityKgPerUnit}`} note="kg per unit" />
          </div>

          {s.byMode.length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">By freight mode</div>
              <div className="flex h-3 overflow-hidden rounded-full bg-fp-line">
                {s.byMode.map((m) => (
                  <div
                    key={m.mode}
                    title={`${m.mode}: ${m.kg.toLocaleString()} kg`}
                    style={{ width: `${Math.max((m.kg / Math.max(s.transportKg, 1)) * 100, 1)}%`, background: MODE_COLOR[m.mode] || '#8A877C' }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3">
                {s.byMode.map((m) => (
                  <span key={m.mode} className="flex items-center gap-1.5 text-[11px] text-fp-ink-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: MODE_COLOR[m.mode] || '#8A877C' }} />
                    {m.mode} · {m.kg.toLocaleString()} kg
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">By warehouse</div>
              <div className="space-y-1.5">
                {data!.warehouses.map((w) => (
                  <div key={w.warehouseId} className="flex items-center gap-2 text-[12px]">
                    <span className="w-14 shrink-0 text-fp-ink-2">WH {w.warehouseId}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-fp-line">
                      <span
                        className="block h-full rounded-full bg-fp-accent"
                        style={{ width: `${Math.max((w.totalKg / Math.max(s.totalKg, 1)) * 100, 2)}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-fp-ink">
                      {w.totalKg.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
                Top-emitting suppliers
              </div>
              <div className="space-y-1.5">
                {s.topSuppliers.map((t) => (
                  <div key={t.supplier} className="flex items-center justify-between gap-2 rounded-lg bg-fp-bg px-3 py-1.5 text-[12px]">
                    <span className="truncate text-fp-ink-2">
                      {t.supplier} <span className="text-fp-ink-3">({t.mode})</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-fp-ink">{t.kg.toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-fp-line bg-fp-bg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fp-ink-3">{label}</div>
      <div className="mt-0.5 text-[22px] font-bold leading-none text-fp-ink">{value}</div>
      <div className="mt-0.5 text-[10px] text-fp-ink-3">{note}</div>
    </div>
  );
}
