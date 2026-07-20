import { useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type CachePolicyRow = {
  tool_name: string;
  enabled: boolean;
  ttl_seconds: number | null;
  key_strategy: 'global' | 'per_user';
  configured: boolean;
};

// Write tools never pass through the read cache — hide them from the list.
const WRITE_TOOLS = new Set(['moveStock', 'draftPurchaseRequisition', 'receivePurchaseOrder', 'adjustStock', 'transferStock']);

/**
 * Per-tool cache policies (spec alignment): TTL, on/off, and key sharing
 * strategy per read tool. Unset TTL falls back to the system default.
 */
export function CachePoliciesCard({ client, onSaved }: { client: AxiosInstance; onSaved: (msg: string) => void }) {
  const [rows, setRows] = useState<CachePolicyRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { enabled: boolean; ttl: string; strategy: 'global' | 'per_user' }>>({});

  async function load() {
    const res = await client.get('/api/admin/users/cache-policies/list');
    const data = (res.data as CachePolicyRow[]).filter((r) => !WRITE_TOOLS.has(r.tool_name));
    setRows(data);
    setDrafts(
      Object.fromEntries(
        data.map((r) => [
          r.tool_name,
          { enabled: r.enabled, ttl: r.ttl_seconds == null ? '' : String(r.ttl_seconds), strategy: r.key_strategy },
        ]),
      ),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(tool: string) {
    const d = drafts[tool];
    if (!d) {
      return;
    }
    await client.patch(`/api/admin/users/cache-policies/${encodeURIComponent(tool)}`, {
      enabled: d.enabled,
      ttl_seconds: d.ttl === '' ? null : Number(d.ttl),
      key_strategy: d.strategy,
    });
    onSaved(`Cache policy for ${tool} saved — takes effect within 30s.`);
    await load();
  }

  return (
    <section className="card p-5">
      <h3 className="mb-1 text-sm font-semibold text-fp-ink">Cache policies</h3>
      <p className="mb-3 text-xs text-fp-ink-3">
        Per-tool read caching: turn it off for volatile data, set a TTL in seconds (empty = system default), and choose
        whether entries are shared across the org or private per user.
      </p>

      {rows.length === 0 ? (
        <div className="py-4 text-center text-xs text-fp-ink-3">
          No read tools observed yet — policies appear after the first chat queries.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-fp-line">
                <th className="table-head">Tool</th>
                <th className="table-head">Caching</th>
                <th className="table-head">TTL (seconds)</th>
                <th className="table-head">Key strategy</th>
                <th className="table-head"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = drafts[r.tool_name] || { enabled: true, ttl: '', strategy: 'global' as const };
                return (
                  <tr key={r.tool_name} className="border-b border-fp-line last:border-0">
                    <td className="table-cell font-medium">
                      {r.tool_name}
                      {r.configured && <span className="chip ml-2 bg-fp-accent-soft text-fp-accent-dark">custom</span>}
                    </td>
                    <td className="table-cell">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={d.enabled}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [r.tool_name]: { ...d, enabled: e.target.checked } }))
                          }
                        />
                        {d.enabled ? 'on' : 'off'}
                      </label>
                    </td>
                    <td className="table-cell">
                      <input
                        className="input !w-28 py-1.5 text-xs"
                        placeholder="default"
                        value={d.ttl}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.tool_name]: { ...d, ttl: e.target.value.replace(/[^0-9]/g, '') },
                          }))
                        }
                      />
                    </td>
                    <td className="table-cell">
                      <select
                        className="input !w-32 py-1.5 text-xs"
                        value={d.strategy}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [r.tool_name]: { ...d, strategy: e.target.value as 'global' | 'per_user' },
                          }))
                        }
                      >
                        <option value="global">shared (org)</option>
                        <option value="per_user">per user</option>
                      </select>
                    </td>
                    <td className="table-cell">
                      <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => void save(r.tool_name)}>
                        <Icon path={paths.check} size={12} strokeWidth={2.4} />
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
