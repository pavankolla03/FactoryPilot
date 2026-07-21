import { useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

export type BusinessObject = {
  id: string;
  org_id: string | null;
  object_code: string;
  object_name: string;
  keywords: string;
  destination_name: string | null;
  odata_service_path: string;
  entity_set: string;
  default_filters: string | null;
  select_fields: string | null;
  date_field: string | null;
  api_version: 'v2' | 'v4';
  top_limit: number;
  is_active: boolean;
};

const EMPTY: Omit<BusinessObject, 'id' | 'org_id'> = {
  object_code: '',
  object_name: '',
  keywords: '',
  destination_name: '',
  odata_service_path: '',
  entity_set: '',
  default_filters: "Plant eq '{warehouseId}'",
  select_fields: '',
  date_field: '',
  api_version: 'v2',
  top_limit: 50,
  is_active: true,
};

/**
 * Business Object registry (spec App #1): register SAP OData objects so Otto can
 * query them with no code change. Add/edit config, toggle active, test connection.
 */
export function BusinessObjectsCard({ client, onSaved }: { client: AxiosInstance; onSaved: (msg: string) => void }) {
  const [rows, setRows] = useState<BusinessObject[]>([]);
  const [editing, setEditing] = useState<BusinessObject | null>(null);
  const [creating, setCreating] = useState(false);
  const [tested, setTested] = useState<Record<string, { ok: boolean; message: string }>>({});

  async function load() {
    const res = await client.get('/api/admin/business-objects/list');
    setRows(res.data);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(row: BusinessObject) {
    await client.patch(`/api/admin/business-objects/${row.id}`, { is_active: !row.is_active });
    onSaved(`${row.object_name} ${row.is_active ? 'deactivated' : 'activated'}.`);
    await load();
  }

  async function testConnection(row: BusinessObject) {
    const res = await client.post(`/api/admin/business-objects/${row.id}/test-connection`, {});
    setTested((prev) => ({ ...prev, [row.id]: { ok: res.data.ok, message: res.data.message } }));
  }

  async function remove(row: BusinessObject) {
    await client.delete(`/api/admin/business-objects/${row.id}`);
    onSaved(`${row.object_name} removed.`);
    await load();
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fp-ink">Business objects (SAP OData registry)</h3>
        <button
          className="flex items-center gap-1 rounded-lg bg-fp-accent-soft px-2.5 py-1 text-[11px] font-semibold text-fp-accent-dark transition hover:bg-fp-accent hover:text-white"
          onClick={() => {
            setEditing({ id: '', org_id: null, ...EMPTY });
            setCreating(true);
          }}
        >
          <Icon path={paths.plus} size={11} strokeWidth={2.6} />
          Add object
        </button>
      </div>
      <p className="mb-3 text-xs text-fp-ink-3">
        Register an SAP business object (service path, entity set, filters, keywords) and Otto can answer questions about
        it with no code change — served through the generic iFlow OData path.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-fp-line">
              <th className="table-head">Object</th>
              <th className="table-head">Service / entity set</th>
              <th className="table-head">Active</th>
              <th className="table-head"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-fp-line last:border-0 align-top">
                <td className="table-cell">
                  <div className="font-semibold text-fp-ink">{r.object_name}</div>
                  <div className="text-[11px] text-fp-ink-3">
                    {r.object_code} · {r.api_version}
                  </div>
                </td>
                <td className="table-cell">
                  <div className="font-mono text-[11px] text-fp-ink-2">{r.odata_service_path}</div>
                  <div className="font-mono text-[11px] text-fp-accent-dark">{r.entity_set}</div>
                  {tested[r.id] && (
                    <div className={`mt-1 text-[11px] ${tested[r.id].ok ? 'text-fp-good' : 'text-fp-bad'}`}>
                      {tested[r.id].ok ? '✓ ' : '✗ '}
                      {tested[r.id].message}
                    </div>
                  )}
                </td>
                <td className="table-cell">
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={r.is_active} onChange={() => void toggle(r)} />
                    {r.is_active ? 'on' : 'off'}
                  </label>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    <button className="btn-ghost px-2.5 py-1 text-[11px]" onClick={() => void testConnection(r)}>
                      Test
                    </button>
                    <button
                      className="btn-ghost px-2.5 py-1 text-[11px]"
                      onClick={() => {
                        setEditing(r);
                        setCreating(false);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="grid h-7 w-7 place-items-center rounded-lg border border-fp-line text-fp-ink-3 transition hover:border-fp-bad hover:text-fp-bad"
                      title="Remove"
                      onClick={() => void remove(r)}
                    >
                      <Icon path={paths.trash} size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ObjectEditor
          value={editing}
          creating={creating}
          onCancel={() => setEditing(null)}
          onSave={async (patch) => {
            if (creating) {
              await client.post('/api/admin/business-objects', patch);
              onSaved(`${patch.object_name} registered.`);
            } else {
              await client.patch(`/api/admin/business-objects/${editing.id}`, patch);
              onSaved(`${patch.object_name} updated.`);
            }
            setEditing(null);
            await load();
          }}
        />
      )}
    </section>
  );
}

function ObjectEditor({
  value,
  creating,
  onCancel,
  onSave,
}: {
  value: BusinessObject;
  creating: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [f, setF] = useState(value);
  const set = (k: keyof BusinessObject, v: unknown) => setF((prev) => ({ ...prev, [k]: v }));

  const field = (label: string, key: keyof BusinessObject, placeholder = '', mono = false) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">{label}</span>
      <input
        className={`input py-2 text-xs ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder}
        value={(f[key] as string) ?? ''}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="mt-4 rounded-2xl border border-fp-line bg-fp-bg p-4">
      <div className="mb-3 text-sm font-semibold text-fp-ink">
        {creating ? 'Register a business object' : `Edit ${value.object_name}`}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {field('Object code', 'object_code', 'SALES')}
        {field('Display name', 'object_name', 'Sales Orders')}
        {field('Keywords (comma-separated)', 'keywords', 'orders, sales order, SO')}
        {field('Destination', 'destination_name', 'S4_SALES (optional)')}
        {field('OData service path', 'odata_service_path', '/sap/opu/odata/sap/API_SALES_ORDER_SRV', true)}
        {field('Entity set', 'entity_set', 'A_SalesOrder', true)}
        {field('Default filters', 'default_filters', "Plant eq '{warehouseId}'", true)}
        {field('Select fields', 'select_fields', 'SalesOrder,Plant,OverallStatus', true)}
        {field('Date field (for "today")', 'date_field', 'RequestedDeliveryDate', true)}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
              OData version
            </span>
            <select
              className="input py-2 text-xs"
              value={f.api_version}
              onChange={(e) => set('api_version', e.target.value)}
            >
              <option value="v2">v2</option>
              <option value="v4">v4</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">Top limit</span>
            <input
              className="input py-2 text-xs"
              value={String(f.top_limit)}
              onChange={(e) => set('top_limit', Number(e.target.value.replace(/[^0-9]/g, '')) || 50)}
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="btn-primary px-4 py-2 text-xs"
          disabled={!f.object_code.trim() || !f.object_name.trim() || !f.odata_service_path.trim() || !f.entity_set.trim()}
          onClick={() =>
            void onSave({
              object_code: f.object_code,
              object_name: f.object_name,
              keywords: f.keywords,
              destination_name: f.destination_name || null,
              odata_service_path: f.odata_service_path,
              entity_set: f.entity_set,
              default_filters: f.default_filters || null,
              select_fields: f.select_fields || null,
              date_field: f.date_field || null,
              api_version: f.api_version,
              top_limit: f.top_limit,
            })
          }
        >
          {creating ? 'Register' : 'Save changes'}
        </button>
        <button className="btn-ghost px-4 py-2 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
