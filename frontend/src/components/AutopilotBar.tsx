import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

/**
 * Autopilot (beta, Phase N): org-level supervisor toggle. When on, the
 * supervisor patrols every warehouse each 30 minutes and dispatches the
 * right specialist agent. The toggle is the kill switch.
 */
export function AutopilotBar({ client, onDispatched }: { client: AxiosInstance; onDispatched: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/admin/users/org');
      setEnabled(Boolean(res.data?.autopilot));
    } catch {
      setEnabled(null);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (enabled === null) {
    return null;
  }

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        enabled ? 'border-fp-good bg-fp-good-soft/40' : 'border-fp-line bg-fp-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${enabled ? 'bg-fp-good text-white' : 'bg-fp-bg text-fp-ink-3'}`}>
          <Icon path={paths.bolt} size={16} strokeWidth={2.2} />
        </span>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
            Autopilot
            <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
            {enabled && <span className="chip bg-fp-good-soft text-fp-good">active</span>}
          </div>
          <div className="text-xs text-fp-ink-3">
            The supervisor patrols all warehouses every 30 min and dispatches forecast, replenishment, and PO-chase
            runs on its own. Writes still follow your approval policies.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <button
            className="btn-ghost px-3 py-2 text-xs"
            disabled={running}
            onClick={() => {
              setRunning(true);
              void client
                .post('/api/agents/autopilot/run')
                .then(() => onDispatched())
                .finally(() => setRunning(false));
            }}
          >
            {running ? 'Patrolling…' : 'Patrol now'}
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-fp-ink-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              const next = e.target.checked;
              setEnabled(next);
              void client.patch('/api/admin/users/org/autopilot', { enabled: next }).catch(() => setEnabled(!next));
            }}
          />
          {enabled ? 'On' : 'Off'}
        </label>
      </div>
    </div>
  );
}
