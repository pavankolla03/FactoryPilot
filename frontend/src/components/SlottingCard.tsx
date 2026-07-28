import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';
import { usePlants, plantLabel } from '../usePlants';

type Proposal = {
  productId: string;
  fromLocation: string;
  toLocation: string;
  qty: number;
  picks: number;
  velocity: 'fast' | 'medium';
  rationale: string;
};


/**
 * Slotting optimizer (Phase Z): pick-frequency relocation proposals. "Propose
 * move" routes through the same governed move-approval flow as the board.
 */
export function SlottingCard({
  client,
  onToast,
  onExplain,
}: {
  client: AxiosInstance;
  onToast: (msg: string) => void;
  onExplain: (warehouseId: string) => void;
}) {
  const plants = usePlants(client);
  const [warehouseId, setWarehouseId] = useState('1010');
  const [rows, setRows] = useState<Proposal[] | null>(null);
  // Why the list is empty, when the reason is a data gap rather than "nothing to do".
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposing, setProposing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get(`/api/ops/slotting/${warehouseId}`);
      setRows(res.data.proposals);
      setUnavailable(res.data.unavailableReason ?? null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, warehouseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function propose(p: Proposal) {
    const id = `${p.productId}-${p.fromLocation}`;
    setProposing(id);
    try {
      const res = await client.post('/api/ops/move-request', {
        warehouseId,
        productId: p.productId,
        fromLocation: p.fromLocation,
        toLocation: p.toLocation,
        qty: p.qty,
      });
      onToast(
        res.data?.executed
          ? `Slotting move executed: ${p.qty} × ${p.productId} → ${p.toLocation} (auto-approved).`
          : `Slotting move sent for approval: ${p.qty} × ${p.productId} → ${p.toLocation}. See Approvals.`,
      );
    } catch (e) {
      onToast('Slotting move failed — check your write scope for this warehouse.');
    } finally {
      setProposing(null);
    }
  }

  if (error) {
    return null;
  }

  return (
    <section className="card mb-5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Slotting optimizer
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <div className="flex items-center gap-2">
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
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => onExplain(warehouseId)}>
            Ask Otto
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[11px]" onClick={() => void load()}>
            <Icon path={paths.history} size={12} strokeWidth={2.2} />
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Fast movers picked from reserve locations (bulk/receiving) that belong on a forward pick face
        (packing/shipping) — 7-day pick frequency. Each proposal executes as a governed move.
      </p>

      {!rows && loading && <div className="py-4 text-center text-xs text-fp-ink-3">Analyzing pick frequency…</div>}
      {rows && rows.length === 0 && (
        // "Already well slotted" and "we cannot tell" look identical on screen
        // but mean opposite things, so an empty list only claims the former
        // when the analysis actually ran.
        <div
          className={`py-6 text-center text-xs leading-relaxed ${
            unavailable ? 'text-fp-warn' : 'text-fp-ink-3'
          }`}
        >
          {unavailable ?? `No relocation opportunities in WH ${warehouseId} — fast movers are already on forward pick faces.`}
        </div>
      )}

      <div className="space-y-2">
        {(rows ?? []).map((p) => {
          const id = `${p.productId}-${p.fromLocation}`;
          return (
            <div key={id} className="flex items-center gap-3 rounded-xl border border-fp-line bg-fp-bg px-3.5 py-2.5">
              <span
                className={`chip shrink-0 ${p.velocity === 'fast' ? 'bg-fp-bad-soft text-fp-bad' : 'bg-fp-warn-soft text-fp-warn'}`}
              >
                {p.picks}× · {p.velocity}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fp-ink">
                  {p.productId}
                  <span className="text-fp-ink-3">
                    {p.fromLocation} <span className="text-fp-accent">→</span> {p.toLocation}
                  </span>
                  <span className="text-fp-ink-3">· {p.qty} units</span>
                </div>
                <div className="truncate text-[11px] text-fp-ink-3">{p.rationale}</div>
              </div>
              <button
                className="shrink-0 rounded-lg bg-fp-navy px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-fp-accent-dark disabled:opacity-50"
                disabled={proposing === id}
                onClick={() => void propose(p)}
              >
                {proposing === id ? '…' : 'Propose move'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
