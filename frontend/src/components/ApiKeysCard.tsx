import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

/**
 * Programmatic Otto access (beta): personal API keys usable with the
 * x-api-key header against POST /api/v1/ask and every other endpoint.
 */
export function ApiKeysCard({ client }: { client: AxiosInstance }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/auth/api-keys');
      setKeys(res.data);
    } catch {
      setKeys([]);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) {
      return;
    }
    const res = await client.post('/api/auth/api-keys', { name: name.trim() });
    setFreshKey(res.data.key);
    setName('');
    await load();
  }

  async function revoke(id: string) {
    await client.delete(`/api/auth/api-keys/${id}`);
    await load();
  }

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
        API keys
        <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
      </h3>
      <p className="mb-3 text-xs text-fp-ink-3">
        Call Otto from scripts and integrations: send the key as an <code>x-api-key</code> header to{' '}
        <code>POST /api/v1/ask</code>. Keys carry your exact role and warehouse scopes.
      </p>

      {freshKey && (
        <div className="mb-3 rounded-xl border border-fp-accent bg-fp-accent-soft/40 px-3 py-2.5">
          <div className="text-[11px] font-semibold text-fp-accent-dark">
            Copy this key now — it is shown only once:
          </div>
          <code className="break-all text-xs text-fp-ink">{freshKey}</code>
          <button className="btn-ghost ml-2 px-2 py-1 text-[11px]" onClick={() => setFreshKey(null)}>
            Done
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <input
          className="input !w-56 py-2 text-xs"
          placeholder="Key name (e.g. shift-dashboard)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary px-3 py-2 text-xs" onClick={() => void create()}>
          <Icon path={paths.plus} size={12} strokeWidth={2.4} />
          Create key
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-xs text-fp-ink-3">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 rounded-xl border border-fp-line px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-fp-ink">{k.name}</div>
                <div className="text-[11px] text-fp-ink-3">
                  {k.prefix}… · created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleString()}` : ' · never used'}
                </div>
              </div>
              <button
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fp-ink-3 transition hover:bg-fp-bad-soft hover:text-fp-bad"
                title="Revoke"
                onClick={() => void revoke(k.id)}
              >
                <Icon path={paths.x} size={12} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
