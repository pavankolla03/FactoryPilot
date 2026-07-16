import { useId } from 'react';
import type { ReactNode } from 'react';

export function Icon({ path, size = 18, strokeWidth = 1.7 }: { path: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const paths = {
  chat: 'M21 12a8 8 0 01-8 8H4l2.5-2.7A8 8 0 1121 12z',
  chart: 'M4 20h16M6 16v-5m4 5V8m4 8v-3m4 3V5',
  logs: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  users: 'M16 19a4 4 0 00-8 0M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19 8v4m2-2h-4',
  send: 'M5 12h13M13 6l6 6-6 6',
  bolt: 'M13 3L4 14h6l-1 7 9-11h-6l1-7z',
  shield: 'M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3z',
  db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zm8 2c0 1.7-3.6 3-8 3s-8-1.3-8-3m16 5c0 1.7-3.6 3-8 3s-8-1.3-8-3M4 5v12c0 1.7 3.6 3 8 3s8-1.3 8-3V5',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  clock: 'M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M9 7V5h6v2m-8 0l1 13h8l1-13',
  warehouse: 'M3 9l9-5 9 5v11H3V9zm4 11v-7h10v7M9 16h6',
  bell: 'M18 9a6 6 0 10-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9zm-4.3 10a2 2 0 01-3.4 0',
  mic: 'M12 3a3 3 0 013 3v5a3 3 0 11-6 0V6a3 3 0 013-3zm-7 8a7 7 0 0014 0M12 18v3',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zm-9 9h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9z',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  history: 'M4 6v5h5M4.5 11A8 8 0 1112 20a8 8 0 01-7.5-9zM12 8v4l3 2',
  logout: 'M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5M10 4h8a2 2 0 012 2v12a2 2 0 01-2 2h-8',
};

export function LogoMark({ size = 34, animate = false }: { size?: number; animate?: boolean }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={animate ? 'logo-thinking' : undefined}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill={`url(#${gradientId})`} />
      {/* factory silhouette */}
      <path d="M9.5 29.5v-9.2l6.2 3.9v-3.9l6.2 3.9v-3.9l6.2 3.9v5.3h-18.6z" fill="white" />
      {/* chimney */}
      <path d="M12 20.5v-8h3.4v8" fill="white" />
      {/* pilot arrow */}
      <path
        d="M22.5 11.5h8m0 0-3-3m3 3-3 3"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2A78D6" />
          <stop offset="1" stopColor="#1B4E94" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    success: { cls: 'bg-fp-good-soft text-fp-good', icon: paths.check, label: 'Success' },
    error: { cls: 'bg-fp-bad-soft text-fp-bad', icon: paths.x, label: 'Error' },
    blocked_scope: { cls: 'bg-fp-warn-soft text-fp-warn', icon: paths.shield, label: 'Scope blocked' },
    blocked_quota: { cls: 'bg-fp-warn-soft text-fp-warn', icon: paths.clock, label: 'Quota blocked' },
  };
  const item = map[status] || map.error;
  return (
    <span className={`chip ${item.cls}`}>
      <Icon path={item.icon} size={12} strokeWidth={2.2} />
      {item.label}
    </span>
  );
}

export function SourceChip({ source }: { source: 'cache' | 'live' }) {
  if (source === 'cache') {
    return (
      <span className="chip bg-fp-accent-soft text-fp-accent-dark">
        <Icon path={paths.db} size={12} strokeWidth={2} />
        Served from cache
      </span>
    );
  }
  return (
    <span className="chip bg-fp-good-soft text-fp-good">
      <Icon path={paths.bolt} size={12} strokeWidth={2} />
      Live from SAP
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-fp-bg text-fp-ink-3">
        <Icon path={icon} size={20} />
      </div>
      <div className="text-sm font-semibold text-fp-ink-2">{title}</div>
      {hint && <div className="max-w-xs text-xs text-fp-ink-3">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-fp-ink">{title}</h1>
        <p className="mt-0.5 text-sm text-fp-ink-3">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
