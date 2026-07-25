import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type Kind = 'iflow' | 's4hana' | 'btp';

type Connection = {
  id: string;
  kind: Kind;
  name: string;
  config: Record<string, string>;
  active: boolean;
  status: 'ok' | 'error' | 'unknown';
  last_message: string | null;
  last_tested_at: string | null;
  secretHints: Record<string, string>;
};

type FieldDef = { key: string; label: string; placeholder?: string; secret?: boolean; type?: 'select'; options?: string[] };

const KINDS: Record<Kind, { title: string; blurb: string; fields: FieldDef[] }> = {
  iflow: {
    title: 'SAP Integration Suite (iFlow)',
    blurb: 'Your deployed iFlow HTTPS endpoint. Once active, all business-object reads go through it instead of mock data.',
    fields: [
      { key: 'url', label: 'iFlow endpoint URL', placeholder: 'https://<tenant>.it-cpi###.cfapps.<region>.hana.ondemand.com/http/factorypilot/odata' },
      { key: 'method', label: 'Method', type: 'select', options: ['POST', 'GET'] },
      { key: 'auth', label: 'Auth', type: 'select', options: ['basic', 'apikey', 'oauth2', 'none'] },
      { key: 'username', label: 'Username (basic)', placeholder: 'sb-...' },
      { key: 'password', label: 'Password (basic)', secret: true },
      { key: 'apiKey', label: 'API key', secret: true },
      { key: 'apiKeyHeader', label: 'API key header', placeholder: 'APIKey' },
      { key: 'tokenUrl', label: 'OAuth2 token URL', placeholder: 'https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token' },
      { key: 'clientId', label: 'OAuth2 client id' },
      { key: 'clientSecret', label: 'OAuth2 client secret', secret: true },
      { key: 'probeService', label: 'Test service path', placeholder: '/sap/opu/odata/sap/API_PRODUCT_SRV' },
      { key: 'probeEntitySet', label: 'Test entity set', placeholder: 'A_Product' },
    ],
  },
  s4hana: {
    title: 'S/4HANA · Business Accelerator Hub',
    blurb: 'Direct OData v2 — point at the SAP sandbox with your api.sap.com key today, at your S/4 tenant later. Used when no iFlow is active.',
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://sandbox.api.sap.com/s4hanacloud' },
      { key: 'auth', label: 'Auth', type: 'select', options: ['apikey', 'basic', 'none'] },
      { key: 'apiKey', label: 'API key (api.sap.com)', secret: true },
      { key: 'apiKeyHeader', label: 'API key header', placeholder: 'APIKey' },
      { key: 'username', label: 'Username (basic)' },
      { key: 'password', label: 'Password (basic)', secret: true },
      { key: 'probeService', label: 'Test service path', placeholder: '/sap/opu/odata/sap/API_PRODUCT_SRV' },
      { key: 'probeEntitySet', label: 'Test entity set', placeholder: 'A_Product' },
    ],
  },
  btp: {
    title: 'SAP BTP tenant',
    blurb: 'Subaccount details + XSUAA client credentials. Connect validates by fetching a token from your tenant.',
    fields: [
      { key: 'subaccount', label: 'Subaccount', placeholder: 'factorypilot-prod' },
      { key: 'region', label: 'Region', placeholder: 'eu10' },
      { key: 'cfApi', label: 'CF API endpoint', placeholder: 'https://api.cf.eu10.hana.ondemand.com' },
      { key: 'org', label: 'CF org' },
      { key: 'space', label: 'CF space', placeholder: 'prod' },
      { key: 'tokenUrl', label: 'XSUAA token URL', placeholder: 'https://<tenant>.authentication.eu10.hana.ondemand.com/oauth/token' },
      { key: 'clientId', label: 'Client id' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
};

const STATUS_CHIP: Record<Connection['status'], string> = {
  ok: 'bg-fp-good-soft text-fp-good',
  error: 'bg-fp-bad-soft text-fp-bad',
  unknown: 'bg-fp-bg text-fp-ink-3',
};

/**
 * Connection Center (Phase AD): register, test and activate the customer's real
 * SAP landscape from the UI — no env editing, no redeploy. Secrets are sealed
 * server-side and only ever returned as masked hints.
 */
export function ConnectionsCard({ client, onSaved }: { client: AxiosInstance; onSaved: (msg: string) => void }) {
  const [rows, setRows] = useState<Connection[]>([]);
  const [editing, setEditing] = useState<{ kind: Kind; id?: string; values: Record<string, string>; name: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/admin/connections');
      setRows(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return null;
  }

  async function test(row: Connection) {
    setTesting(row.id);
    try {
      const res = await client.post(`/api/admin/connections/${row.id}/test`, {});
      onSaved(res.data.ok ? `${row.name}: ${res.data.message}` : `${row.name} failed — ${res.data.message}`);
      await load();
    } finally {
      setTesting(null);
    }
  }

  async function toggle(row: Connection) {
    await client.patch(`/api/admin/connections/${row.id}`, { active: !row.active });
    onSaved(`${row.name} ${row.active ? 'deactivated' : 'activated'}.`);
    await load();
  }

  async function remove(row: Connection) {
    await client.delete(`/api/admin/connections/${row.id}`);
    onSaved(`${row.name} removed.`);
    await load();
  }

  async function save() {
    if (!editing) return;
    const def = KINDS[editing.kind];
    const secrets: Record<string, string> = {};
    const config: Record<string, string> = {};
    for (const f of def.fields) {
      const v = (editing.values[f.key] ?? '').trim();
      if (!v) continue;
      if (f.secret) secrets[f.key] = v;
      else config[f.key] = v;
    }
    const name = editing.name.trim() || def.title;
    if (editing.id) {
      await client.patch(`/api/admin/connections/${editing.id}`, { name, config, secrets });
      onSaved(`${name} updated.`);
    } else {
      await client.post('/api/admin/connections', { kind: editing.kind, name, config, secrets });
      onSaved(`${name} connected — hit Test to verify.`);
    }
    setEditing(null);
    await load();
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
          Connections (SAP landscape)
          <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(KINDS) as Kind[]).map((k) => (
            <button
              key={k}
              className="flex items-center gap-1 rounded-lg bg-fp-accent-soft px-2.5 py-1 text-[11px] font-semibold text-fp-accent-dark transition hover:bg-fp-accent hover:text-white"
              onClick={() => setEditing({ kind: k, values: {}, name: KINDS[k].title })}
            >
              <Icon path={paths.plus} size={11} strokeWidth={2.6} />
              {k === 'iflow' ? 'iFlow' : k === 's4hana' ? 'S/4HANA' : 'BTP tenant'}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Connect your real systems here. An active iFlow (or S/4HANA) connection replaces mock data immediately —
        credentials are encrypted at rest and never returned to the browser.
      </p>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-fp-line py-6 text-center text-xs text-fp-ink-3">
          No systems connected yet — everything runs on the simulator. Add your iFlow endpoint or an S/4HANA / BAH key
          to go live.
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-fp-line bg-fp-bg px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-fp-ink">{r.name}</span>
              <span className="chip bg-fp-surface text-fp-ink-2">
                {r.kind === 'iflow' ? 'iFlow' : r.kind === 's4hana' ? 'S/4HANA' : 'BTP'}
              </span>
              <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status === 'ok' ? 'connected' : r.status}</span>
              {r.active ? (
                <span className="chip bg-fp-good-soft text-fp-good">active</span>
              ) : (
                <span className="chip bg-fp-bg text-fp-ink-3">inactive</span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <button className="btn-ghost px-2.5 py-1 text-[11px]" onClick={() => void test(r)}>
                  {testing === r.id ? 'Testing…' : 'Test'}
                </button>
                <button
                  className="btn-ghost px-2.5 py-1 text-[11px]"
                  onClick={() =>
                    setEditing({ kind: r.kind, id: r.id, name: r.name, values: { ...(r.config as Record<string, string>) } })
                  }
                >
                  Edit
                </button>
                <button className="btn-ghost px-2.5 py-1 text-[11px]" onClick={() => void toggle(r)}>
                  {r.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg border border-fp-line text-fp-ink-3 transition hover:border-fp-bad hover:text-fp-bad"
                  title="Remove"
                  onClick={() => void remove(r)}
                >
                  <Icon path={paths.trash} size={13} />
                </button>
              </div>
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-fp-ink-3">
              {r.config.url || r.config.baseUrl || r.config.cfApi || r.config.tokenUrl || '—'}
              {Object.keys(r.secretHints).length > 0 && (
                <span className="ml-2 font-sans text-fp-ink-3">
                  🔒 {Object.entries(r.secretHints).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </span>
              )}
            </div>
            {r.last_message && (
              <div className={`mt-1 text-[11px] ${r.status === 'ok' ? 'text-fp-good' : 'text-fp-bad'}`}>
                {r.status === 'ok' ? '✓ ' : '✗ '}
                {r.last_message}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="mt-4 rounded-2xl border border-fp-line bg-fp-bg p-4">
          <div className="mb-1 text-sm font-semibold text-fp-ink">
            {editing.id ? 'Edit' : 'Connect'} — {KINDS[editing.kind].title}
          </div>
          <p className="mb-3 text-xs text-fp-ink-3">{KINDS[editing.kind].blurb}</p>

          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
              Display name
            </span>
            <input
              className="input py-2 text-xs"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            {KINDS[editing.kind].fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
                  {f.label}
                  {f.secret && <span className="ml-1 text-fp-ink-3">🔒</span>}
                </span>
                {f.type === 'select' ? (
                  <select
                    className="input py-2 text-xs"
                    value={editing.values[f.key] ?? f.options?.[0] ?? ''}
                    onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [f.key]: e.target.value } })}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input py-2 font-mono text-xs"
                    type={f.secret ? 'password' : 'text'}
                    placeholder={f.secret && editing.id ? 'unchanged' : f.placeholder}
                    value={editing.values[f.key] ?? ''}
                    onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [f.key]: e.target.value } })}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button className="btn-primary px-4 py-2 text-xs" onClick={() => void save()}>
              {editing.id ? 'Save changes' : 'Connect'}
            </button>
            <button className="btn-ghost px-4 py-2 text-xs" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <span className="text-[11px] text-fp-ink-3">
              Secrets are encrypted at rest; leave blank when editing to keep the stored value.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
