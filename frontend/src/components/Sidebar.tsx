import { Icon, LogoMark, initialsOf, paths } from './ui';

export type Tab = 'chat' | 'usage' | 'logs' | 'users';

const NAV: Array<{ id: Tab; label: string; icon: string; adminOnly?: boolean }> = [
  { id: 'chat', label: 'Assistant', icon: paths.chat },
  { id: 'usage', label: 'Usage & Cost', icon: paths.chart },
  { id: 'logs', label: 'Activity', icon: paths.logs },
  { id: 'users', label: 'Access Control', icon: paths.users, adminOnly: true },
];

export function Sidebar({
  tab,
  role,
  displayName,
  onTab,
}: {
  tab: Tab;
  role: 'admin' | 'viewer';
  displayName: string;
  onTab: (t: Tab) => void;
}) {
  return (
    <aside className="flex w-full flex-col bg-fp-navy p-4 md:min-h-screen md:w-[248px]">
      <div className="mb-8 flex items-center gap-3 px-1.5 pt-1.5">
        <LogoMark size={36} />
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-white">FactoryPilot</div>
          <div className="text-[11px] text-[#5B6B81]">SAP Manufacturing AI</div>
        </div>
      </div>

      <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B6B81]">
        Workspace
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.filter((n) => !n.adminOnly || role === 'admin').map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => onTab(n.id)}>
            <Icon path={n.icon} size={17} />
            {n.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 rounded-2xl bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fp-accent text-xs font-bold text-white">
            {initialsOf(displayName)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
            <div className="text-[11px] capitalize text-[#93A3BB]">{role === 'admin' ? 'Administrator' : 'Operator'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
