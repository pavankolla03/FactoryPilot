import { useCallback, useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { usePlants, plantLabel } from '../usePlants';

type Material = {
  materialId: string;
  currentQty: number;
  dailyDemand: number;
  inboundInTime: number;
  projectedEndQty: number;
  baselineEndQty: number;
  daysToStockout: number | null;
  risk: 'stockout' | 'at-risk' | 'ok';
  newlyAtRisk: boolean;
};
type Result = {
  warehouseId: string;
  scenario: { demandMultiplier: number; horizonDays: number; supplierDelayDays: number };
  summary: { materials: number; stockouts: number; atRisk: number; baselineStockouts: number; newStockouts: number; shortfallUnits: number };
  materials: Material[];
};


function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">{label}</span>
      </div>
      <input
        type="range"
        className="w-full accent-fp-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/**
 * What-if Scenario Studio (Phase AA): stress-test the whole warehouse under a
 * demand shock and supplier delay, with a baseline comparison. Zero writes.
 */
export function ScenarioStudioCard({ client }: { client: AxiosInstance }) {
  const plants = usePlants(client);
  const [warehouseId, setWarehouseId] = useState('1010');
  const [demand, setDemand] = useState(2.5);
  const [horizon, setHorizon] = useState(30);
  const [delay, setDelay] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.post('/api/ops/scenario', {
        warehouseId,
        demandMultiplier: demand,
        horizonDays: horizon,
        supplierDelayDays: delay,
      });
      setResult(res.data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, warehouseId, demand, horizon, delay]);

  // Debounced auto-run on any lever change.
  useEffect(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => void run(), 350);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [run]);

  if (error) {
    return null;
  }

  const s = result?.summary;
  const worst = 40; // bar scale reference for projected qty

  return (
    <section className="card mb-5 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          What-if scenario studio
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <select
          className="input !w-28 py-1.5 text-xs"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
        >
          {plants.map((p) => (
            <option key={p.warehouseId} value={p.warehouseId}>
              {plantLabel(p)}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Stress-test the whole warehouse over a horizon. Projected stockouts vs today's baseline — zero writes.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Slider label={`Demand ×${demand.toFixed(1)}`} value={demand} min={0.5} max={3} step={0.1} onChange={setDemand} />
        <Slider label={`Horizon ${horizon} days`} value={horizon} min={7} max={60} step={1} onChange={setHorizon} />
        <Slider label={`Supplier delay +${delay} days`} value={delay} min={0} max={30} step={1} onChange={setDelay} />
      </div>

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Stockouts" value={String(s.stockouts)} tone={s.stockouts > 0 ? 'bad' : 'good'} />
          <Tile
            label="New vs baseline"
            value={s.newStockouts > 0 ? `+${s.newStockouts}` : '0'}
            note={`base ${s.baselineStockouts}`}
            tone={s.newStockouts > 0 ? 'bad' : 'good'}
          />
          <Tile label="At risk" value={String(s.atRisk)} tone={s.atRisk > 0 ? 'warn' : 'good'} />
          <Tile label="Units short" value={s.shortfallUnits.toLocaleString()} tone={s.shortfallUnits > 0 ? 'bad' : 'good'} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fp-line text-left text-fp-ink-3">
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">On hand</th>
              <th className="px-3 py-2">Demand/day</th>
              <th className="px-3 py-2">Inbound</th>
              <th className="px-3 py-2">Projected end</th>
              <th className="px-3 py-2">Days to out</th>
            </tr>
          </thead>
          <tbody>
            {(result?.materials ?? []).slice(0, 14).map((m) => (
              <tr
                key={m.materialId}
                className={`border-b border-fp-line last:border-0 ${m.risk === 'stockout' ? 'bg-fp-bad-soft/40' : ''}`}
              >
                <td className="px-3 py-2 font-medium text-fp-ink">
                  {m.materialId}
                  {m.newlyAtRisk && <span className="chip ml-1.5 bg-fp-warn-soft text-fp-warn">new risk</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{m.currentQty}</td>
                <td className="px-3 py-2 tabular-nums">{m.dailyDemand}</td>
                <td className="px-3 py-2 tabular-nums">{m.inboundInTime || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-10 text-right font-semibold tabular-nums ${m.projectedEndQty < 0 ? 'text-fp-bad' : m.projectedEndQty < 20 ? 'text-fp-warn' : 'text-fp-ink'}`}
                    >
                      {m.projectedEndQty}
                    </span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-fp-line">
                      <span
                        className={`block h-full rounded-full ${m.projectedEndQty < 0 ? 'bg-fp-bad' : m.projectedEndQty < 20 ? 'bg-[#EDA100]' : 'bg-fp-good'}`}
                        style={{ width: `${Math.max(Math.min((m.projectedEndQty / worst) * 100, 100), 4)}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.daysToStockout === null ? '—' : `${m.daysToStockout}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div className="mt-2 text-center text-[11px] text-fp-ink-3">Projecting…</div>}
    </section>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone: 'good' | 'warn' | 'bad' }) {
  const cls = tone === 'bad' ? 'text-fp-bad' : tone === 'warn' ? 'text-fp-warn' : 'text-fp-good';
  return (
    <div className="rounded-xl border border-fp-line bg-fp-bg p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fp-ink-3">{label}</div>
      <div className={`mt-0.5 text-[22px] font-bold leading-none ${cls}`}>{value}</div>
      {note && <div className="mt-0.5 text-[10px] text-fp-ink-3">{note}</div>}
    </div>
  );
}
