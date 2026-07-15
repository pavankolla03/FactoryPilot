import { Icon, LogoMark, paths } from './ui';

type UserRole = 'admin' | 'viewer';

export function Login({
  email,
  displayName,
  role,
  onEmail,
  onDisplayName,
  onRole,
  onSubmit,
}: {
  email: string;
  displayName: string;
  role: UserRole;
  onEmail: (v: string) => void;
  onDisplayName: (v: string) => void;
  onRole: (v: UserRole) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-fp-navy lg:block">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 15%, rgba(42,120,214,0.35) 0, transparent 45%), radial-gradient(circle at 85% 90%, rgba(42,120,214,0.25) 0, transparent 40%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="text-lg font-semibold tracking-tight text-white">FactoryPilot</div>
              <div className="text-xs text-[#93A3BB]">AI Agent for SAP Manufacturing</div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-white">
              Your warehouse, in plain language.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[#ADBBD0]">
              Ask about stock, move products between locations, and audit every request — powered by an LLM agent
              wired to SAP S/4HANA through MCP and Integration Suite.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { icon: paths.bolt, title: 'Agentic operations', text: 'Reads and writes to SAP with human confirmation on every write.' },
                { icon: paths.shield, title: 'Enterprise guardrails', text: 'XSUAA sign-on, per-warehouse scopes, and monthly token budgets.' },
                { icon: paths.db, title: 'Smart caching', text: 'Repeat questions are answered from cache — the backend stays quiet.' },
              ].map((f) => (
                <li key={f.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-[#7FB0E8]">
                    <Icon path={f.icon} size={17} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white">{f.title}</div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-[#93A3BB]">{f.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-xs text-[#5B6B81]">SAP BTP · Cloud Foundry · MCP · Redis · Postgres</div>
        </div>
      </aside>

      <main className="grid place-items-center bg-fp-bg p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <div className="text-lg font-semibold tracking-tight text-fp-ink">FactoryPilot</div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-fp-ink">Sign in</h1>
          <p className="mt-1 text-sm text-fp-ink-3">
            Local development sign-in. In production this is an XSUAA single sign-on redirect.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                Work email
              </label>
              <input className="input" value={email} onChange={(e) => onEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                Display name
              </label>
              <input className="input" value={displayName} onChange={(e) => onDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                Role
              </label>
              <select className="input" value={role} onChange={(e) => onRole(e.target.value as UserRole)}>
                <option value="admin">Administrator — all warehouses</option>
                <option value="viewer">Operator — scoped access</option>
              </select>
            </div>

            <button className="btn-primary w-full py-3" onClick={onSubmit}>
              Continue
              <Icon path={paths.send} size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
