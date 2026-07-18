import { Icon, LogoMark, initialsOf, paths } from './ui';
import { useI18n, type Lang, type TranslationKey } from '../i18n';

export type Tab = 'chat' | 'board' | 'autonomy' | 'approvals' | 'usage' | 'logs' | 'users';

const NAV: Array<{ id: Tab; labelKey: TranslationKey; icon: string; adminOnly?: boolean }> = [
  { id: 'chat', labelKey: 'nav.assistant', icon: paths.chat },
  { id: 'board', labelKey: 'nav.board', icon: paths.warehouse },
  { id: 'autonomy', labelKey: 'nav.autonomy', icon: paths.bolt },
  { id: 'approvals', labelKey: 'nav.approvals', icon: paths.shield },
  { id: 'usage', labelKey: 'nav.usage', icon: paths.chart },
  { id: 'logs', labelKey: 'nav.activity', icon: paths.logs },
  { id: 'users', labelKey: 'nav.access', icon: paths.users, adminOnly: true },
];

export function Sidebar({
  tab,
  role,
  displayName,
  onTab,
  lang,
  onLang,
  onLogout,
  pendingCount,
}: {
  tab: Tab;
  role: 'admin' | 'viewer';
  displayName: string;
  onTab: (t: Tab) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  onLogout: () => void;
  pendingCount: number;
}) {
  const { t } = useI18n();

  return (
    <aside className="flex w-full flex-col bg-fp-navy p-4 md:sticky md:top-0 md:h-screen md:w-[248px] md:overflow-y-auto">
      <div className="mb-8 flex items-center gap-3 px-1.5 pt-1.5">
        <LogoMark size={36} />
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-white">FactoryPilot</div>
          <div className="text-[11px] text-[#5B6B81]">SAP Manufacturing AI</div>
        </div>
      </div>

      <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5B6B81]">
        {t('nav.workspace')}
      </div>
      <nav className="flex-1 space-y-1">
        {NAV.filter((n) => !n.adminOnly || role === 'admin').map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => onTab(n.id)}>
            <Icon path={n.icon} size={17} />
            <span className="flex-1 text-left">{t(n.labelKey)}</span>
            {n.id === 'approvals' && pendingCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-fp-warn-soft px-1 text-[10px] font-bold text-fp-warn">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mb-3 flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
        <span className="grid h-7 w-7 place-items-center text-[#5B6B81]">
          <Icon path={paths.globe} size={14} strokeWidth={2} />
        </span>
        {(['en', 'de'] as Lang[]).map((l) => (
          <button
            key={l}
            className={`flex-1 rounded-lg py-1 text-[11px] font-semibold uppercase transition ${
              lang === l ? 'bg-fp-accent text-white' : 'text-[#93A3BB] hover:text-white'
            }`}
            onClick={() => onLang(l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fp-accent text-xs font-bold text-white">
            {initialsOf(displayName || '?')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{displayName}</div>
            <div className="text-[11px] text-[#93A3BB]">{role === 'admin' ? t('role.admin') : t('role.viewer')}</div>
          </div>
          <button
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#93A3BB] transition hover:bg-white/10 hover:text-white"
            title="Log out"
            onClick={onLogout}
          >
            <Icon path={paths.logout} size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
