import { useState } from 'react';
import { EmptyState, Icon, initialsOf, paths } from './ui';

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'viewer';
  monthly_token_limit: number;
  scopes: Array<{ warehouse_id: string; access_level: 'read' | 'write' }>;
};

export function UsersPage({
  users,
  onCreate,
  onDelete,
  onQuota,
  onScopes,
}: {
  users: AdminUser[];
  onCreate: (u: { email: string; display_name: string; role: 'admin' | 'viewer' }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onQuota: (id: string, limit: number) => Promise<void>;
  onScopes: (id: string, scopes: AdminUser['scopes']) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-fp-ink">Invite a user</h3>
        <div className="grid gap-2.5 md:grid-cols-[1.4fr_1.2fr_1fr_auto]">
          <input className="input" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'viewer')}>
            <option value="viewer">Operator</option>
            <option value="admin">Administrator</option>
          </select>
          <button
            className="btn-primary"
            disabled={!email.includes('@') || !name.trim()}
            onClick={async () => {
              await onCreate({ email, display_name: name, role });
              setEmail('');
              setName('');
              setRole('viewer');
            }}
          >
            <Icon path={paths.plus} size={14} strokeWidth={2.4} />
            Add user
          </button>
        </div>
      </section>

      {users.length === 0 ? (
        <div className="card">
          <EmptyState icon={paths.users} title="No users yet" />
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <UserCard key={u.id} user={u} onDelete={onDelete} onQuota={onQuota} onScopes={onScopes} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  onDelete,
  onQuota,
  onScopes,
}: {
  user: AdminUser;
  onDelete: (id: string) => Promise<void>;
  onQuota: (id: string, limit: number) => Promise<void>;
  onScopes: (id: string, scopes: AdminUser['scopes']) => Promise<void>;
}) {
  const [quota, setQuota] = useState(String(user.monthly_token_limit ?? 50000));
  const [warehouse, setWarehouse] = useState('');
  const [level, setLevel] = useState<'read' | 'write'>('read');
  const scopes = user.scopes || [];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-fp-navy text-xs font-bold text-white">
            {initialsOf(user.display_name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fp-ink">{user.display_name}</span>
              <span className={`chip ${user.role === 'admin' ? 'bg-fp-navy text-white' : 'bg-fp-bg text-fp-ink-2'}`}>
                {user.role === 'admin' ? 'Administrator' : 'Operator'}
              </span>
            </div>
            <div className="text-xs text-fp-ink-3">{user.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-fp-line px-2 py-1">
            <input
              className="w-24 bg-transparent px-1 py-1 text-right text-sm font-medium text-fp-ink outline-none"
              value={quota}
              onChange={(e) => setQuota(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <span className="text-[11px] text-fp-ink-3">tokens/mo</span>
            <button
              className="rounded-lg bg-fp-accent-soft px-2 py-1 text-[11px] font-semibold text-fp-accent-dark transition hover:bg-fp-accent hover:text-white"
              onClick={() => void onQuota(user.id, Number(quota) || 50000)}
            >
              Save
            </button>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-xl border border-fp-line text-fp-ink-3 transition hover:border-fp-bad hover:text-fp-bad"
            title="Remove user"
            onClick={() => void onDelete(user.id)}
          >
            <Icon path={paths.trash} size={15} />
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-fp-line pt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
          Warehouse access {user.role === 'admin' && '· administrators access all warehouses'}
        </div>

        {user.role !== 'admin' && (
          <>
            <div className="flex flex-wrap gap-2">
              {scopes.length === 0 && <span className="text-xs text-fp-ink-3">No warehouses assigned — user cannot query any stock.</span>}
              {scopes.map((s) => (
                <span key={`${s.warehouse_id}-${s.access_level}`} className="chip border border-fp-line bg-fp-surface text-fp-ink-2">
                  <Icon path={paths.warehouse} size={12} strokeWidth={2} />
                  {s.warehouse_id}
                  <span className={s.access_level === 'write' ? 'font-semibold text-fp-accent-dark' : 'text-fp-ink-3'}>
                    {s.access_level}
                  </span>
                  <button
                    className="ml-0.5 text-fp-ink-3 transition hover:text-fp-bad"
                    onClick={() => void onScopes(user.id, scopes.filter((x) => x !== s))}
                  >
                    <Icon path={paths.x} size={11} strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="input !w-40 py-2 text-xs"
                placeholder="Warehouse e.g. 1010"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              />
              <select className="input !w-32 py-2 text-xs" value={level} onChange={(e) => setLevel(e.target.value as 'read' | 'write')}>
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
              <button
                className="btn-ghost px-3 py-2 text-xs"
                disabled={!warehouse.trim()}
                onClick={async () => {
                  await onScopes(user.id, [
                    ...scopes.filter((s) => s.warehouse_id !== warehouse.trim()),
                    { warehouse_id: warehouse.trim(), access_level: level },
                  ]);
                  setWarehouse('');
                }}
              >
                <Icon path={paths.plus} size={12} strokeWidth={2.4} />
                Grant access
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
