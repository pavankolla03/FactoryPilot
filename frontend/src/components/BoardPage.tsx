import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';
import { usePlants, plantLabel } from '../usePlants';

type StockCard = {
  materialId: string;
  productId: string;
  warehouseId: string;
  location: string;
  quantity: number;
};

const LOCATION_ORDER = ['receiving', 'inspection', 'bulk', 'packing', 'shipping'];

/** Per-location accent colors (colorblind-safe categorical palette). */
const LOCATION_COLORS: Record<string, { bar: string; text: string; soft: string }> = {
  receiving: { bar: '#2A78D6', text: '#1E5EB0', soft: 'rgba(42,120,214,0.08)' },
  inspection: { bar: '#4A3AA7', text: '#4A3AA7', soft: 'rgba(74,58,167,0.08)' },
  bulk: { bar: '#B87A00', text: '#9A6B00', soft: 'rgba(237,161,0,0.10)' },
  packing: { bar: '#1B7F3B', text: '#1B7F3B', soft: 'rgba(27,175,122,0.10)' },
  shipping: { bar: '#D95926', text: '#C24E20', soft: 'rgba(235,104,52,0.09)' },
};
const DEFAULT_COLOR = { bar: '#8B99AD', text: '#47586E', soft: 'rgba(139,153,173,0.10)' };

export function BoardPage({
  client,
  onProposed,
}: {
  client: AxiosInstance;
  onProposed: (message: string) => void;
}) {
  const plants = usePlants(client);
  const [warehouseId, setWarehouseId] = useState('1010');
  const [records, setRecords] = useState<StockCard[]>([]);
  const [dataSource, setDataSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragged, setDragged] = useState<StockCard | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ card: StockCard; toLocation: string } | null>(null);
  const [qty, setQty] = useState('');
  const [countCard, setCountCard] = useState<StockCard | null>(null);
  const [countedQty, setCountedQty] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/api/ops/board', { params: { warehouseId } });
      setRecords(res.data.records || []);
      setDataSource(res.data.dataSource || '');
    } catch (e) {
      const detail =
        (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ||
        'failed to load board';
      setError(detail);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [client, warehouseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locations = [
    ...LOCATION_ORDER,
    ...[...new Set(records.map((r) => r.location))].filter((l) => !LOCATION_ORDER.includes(l)),
  ];

  async function submitMove() {
    if (!pendingDrop) {
      return;
    }
    const moveQty = Math.min(Number(qty) || 0, pendingDrop.card.quantity);
    if (moveQty <= 0) {
      return;
    }
    const { card, toLocation } = pendingDrop;
    setPendingDrop(null);
    try {
      const res = await client.post('/api/ops/move-request', {
        warehouseId,
        productId: card.productId,
        fromLocation: card.location,
        toLocation,
        qty: moveQty,
      });
      if (res.data.executed) {
        onProposed(`Move executed automatically by policy: ${moveQty} × ${card.productId} → ${toLocation}.`);
        await load();
      } else {
        onProposed(
          `Move of ${moveQty} × ${card.productId} → ${toLocation} sent for approval — check the Approvals tab.`,
        );
      }
    } catch (e) {
      const detail =
        (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ||
        'move request failed';
      onProposed(`Move rejected: ${detail}`);
    }
  }

  async function submitCount() {
    if (!countCard) {
      return;
    }
    const counted = Number(countedQty);
    if (!Number.isInteger(counted) || counted < 0) {
      return;
    }
    const card = countCard;
    setCountCard(null);
    if (counted === card.quantity) {
      onProposed(`Count matches the system quantity (${counted}) — no adjustment needed.`);
      return;
    }
    try {
      await client.post('/api/ops/adjust-request', {
        warehouseId,
        productId: card.productId,
        location: card.location,
        countedQty: counted,
        systemQty: card.quantity,
      });
      onProposed(
        `Cycle-count adjustment for ${card.productId} (${card.quantity} → ${counted}) sent for approval.`,
      );
    } catch (e) {
      const detail =
        (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message ||
        'adjustment request failed';
      onProposed(`Adjustment rejected: ${detail}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select className="input !w-40 py-2 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {plants.map((p) => (
              <option key={p.warehouseId} value={p.warehouseId}>
                Warehouse {p.warehouseId}
                {p.live ? ' · live' : ''}
              </option>
            ))}
          </select>
          <button className="btn-ghost px-3 py-2 text-xs" onClick={() => void load()}>
            <Icon path={paths.history} size={13} strokeWidth={2} />
            Refresh
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-fp-ink-3">
          {dataSource && (
            <span
              className={`chip ${
                /simulator/i.test(dataSource) || /last known good/i.test(dataSource)
                  ? 'bg-fp-warn-soft text-fp-warn'
                  : 'bg-fp-good-soft text-fp-good'
              }`}
              title={dataSource}
            >
              {/simulator/i.test(dataSource)
                ? '○ Simulated data'
                : /last known good/i.test(dataSource)
                  ? `◑ ${dataSource.replace('sap-iflow ', '').replace(/[()]/g, '')}`
                  : dataSource === 'sap-sandbox'
                    ? '● Live SAP sandbox'
                    : '● Live from SAP iFlow'}
            </span>
          )}
          <span>Drag a card to another location to propose a stock move.</span>
        </div>
      </div>

      {error && <div className="rounded-xl bg-fp-bad-soft px-4 py-3 text-sm font-medium text-fp-bad">{error}</div>}

      <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
        {locations.map((location) => {
          const cards = records.filter((r) => r.location === location);
          const total = cards.reduce((sum, c) => sum + c.quantity, 0);
          const color = LOCATION_COLORS[location.toLowerCase()] || DEFAULT_COLOR;
          return (
            <div
              key={location}
              style={{
                borderTop: `3px solid ${color.bar}`,
                background: dropTarget === location && dragged && dragged.location !== location ? undefined : color.soft,
              }}
              className={`flex min-h-[300px] flex-col rounded-2xl border p-3 transition ${
                dropTarget === location && dragged && dragged.location !== location
                  ? 'border-fp-accent bg-fp-accent-soft/40'
                  : 'border-fp-line'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(location);
              }}
              onDragLeave={() => setDropTarget((prev) => (prev === location ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                setDropTarget(null);
                if (dragged && dragged.location !== location) {
                  setPendingDrop({ card: dragged, toLocation: location });
                  setQty(String(dragged.quantity));
                }
                setDragged(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: color.text }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: color.bar }} />
                  {location}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: color.text, background: '#FFFFFF' }}
                >
                  {total.toLocaleString()} u
                </span>
              </div>

              <div className="flex-1 space-y-2">
                {cards.length === 0 && !loading && (
                  <div className="rounded-xl border border-dashed border-fp-line px-3 py-5 text-center text-[11px] text-fp-ink-3">
                    empty
                  </div>
                )}
                {cards.map((card) => (
                  <div
                    key={`${card.materialId}-${card.location}`}
                    draggable
                    onDragStart={() => setDragged(card)}
                    onDragEnd={() => {
                      setDragged(null);
                      setDropTarget(null);
                    }}
                    className="cursor-grab rounded-xl border border-fp-line bg-fp-surface p-3 shadow-card transition hover:border-fp-accent active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-fp-ink">{card.productId}</span>
                      <button
                        className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fp-ink-3 transition hover:bg-fp-accent-soft hover:text-fp-accent-dark"
                        title="Cycle count: enter the physically counted quantity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCountCard(card);
                          setCountedQty(String(card.quantity));
                        }}
                      >
                        count
                      </button>
                    </div>
                    <div className="truncate text-[11px] text-fp-ink-3">{card.materialId}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums text-fp-ink">
                        {card.quantity.toLocaleString()}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-fp-ink-3">units</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {countCard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setCountCard(null)}>
          <div className="w-80 rounded-2xl bg-fp-surface p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-fp-ink">
              Cycle count — {countCard.productId} @ {countCard.location}
            </h4>
            <p className="mt-1 text-xs text-fp-ink-3">
              System shows <strong>{countCard.quantity.toLocaleString()}</strong> units. Enter the physically counted
              quantity — discrepancies become an approval-gated adjustment.
            </p>
            <input
              className="input mt-3"
              type="number"
              min={0}
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && void submitCount()}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-xs" onClick={() => void submitCount()}>
                Submit count
              </button>
              <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => setCountCard(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDrop && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setPendingDrop(null)}>
          <div className="w-80 rounded-2xl bg-fp-surface p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-fp-ink">
              Move {pendingDrop.card.productId} → {pendingDrop.toLocation}
            </h4>
            <p className="mt-1 text-xs text-fp-ink-3">
              {pendingDrop.card.quantity.toLocaleString()} units available in {pendingDrop.card.location}. The move
              goes through the normal approval flow.
            </p>
            <input
              className="input mt-3"
              type="number"
              min={1}
              max={pendingDrop.card.quantity}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && void submitMove()}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-xs" onClick={() => void submitMove()}>
                Propose move
              </button>
              <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => setPendingDrop(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
