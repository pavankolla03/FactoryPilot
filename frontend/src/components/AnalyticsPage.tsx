import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SessionLogEntry } from '@manufacturing-agent/shared';
import { Icon, paths } from './ui';
import { useI18n } from '../i18n';

type TokenRow = { user_id: string; email: string; day: string; total_tokens: number };

export type AnalyticsOverview = {
  windowDays: number;
  perDay: Array<{ day: string; requests: number; rejected: number; cache_hits: number }>;
  byTool: Array<{ tool: string; calls: number }>;
  byChannel: Array<{ channel: string; requests: number }>;
  totals: {
    requests: number;
    cache_hits: number;
    cache_misses: number;
    rejected: number;
    errors: number;
    avg_latency_ms: number | null;
    avg_cache_hit_ms: number | null;
    avg_tool_ms: number | null;
    avg_llm_ms: number | null;
  };
  topQuestions: Array<{ question: string; times: number }>;
};

export function AnalyticsPage({
  usage,
  tokenRows,
  sessionLogs,
  overview,
  isAdmin,
  onExport,
}: {
  usage: { used: number; limit: number; periodStart: string };
  tokenRows: TokenRow[];
  sessionLogs: SessionLogEntry[];
  overview: AnalyticsOverview | null;
  isAdmin: boolean;
  onExport: () => void;
}) {
  const { t } = useI18n();
  const byDay = useMemo(() => {
    const acc = new Map<string, number>();
    for (const row of tokenRows) {
      const day = String(row.day).slice(0, 10);
      acc.set(day, (acc.get(day) || 0) + Number(row.total_tokens));
    }
    return [...acc.entries()]
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [tokenRows]);

  const stats = useMemo(() => {
    const total = sessionLogs.length;
    const cacheable = sessionLogs.filter((l) => l.cache_status === 'hit' || l.cache_status === 'miss');
    const hits = sessionLogs.filter((l) => l.cache_status === 'hit').length;
    const avgLatency = total
      ? Math.round(sessionLogs.reduce((s, l) => s + Number(l.latency_ms || 0), 0) / total)
      : 0;
    return {
      requests: total,
      cacheRate: cacheable.length ? Math.round((hits / cacheable.length) * 100) : 0,
      avgLatency,
    };
  }, [sessionLogs]);

  const pct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-fp-ink-3">{t('usage.tokens')}</span>
            <Icon path={paths.spark} size={16} strokeWidth={2} />
          </div>
          <div className={`mt-2 text-[26px] font-semibold tracking-tight ${TONE_TEXT[toneFor(pct, 50, 75)]}`}>
            {usage.used.toLocaleString()}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fp-line">
            <div className={`h-full rounded-full ${TONE_BAR[toneFor(pct, 50, 75)]}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-fp-ink-3">
            {pct}% of {usage.limit.toLocaleString()} budget
          </div>
        </div>

        <StatTile icon={paths.chat} label={t('usage.requests')} value={stats.requests.toLocaleString()} note="last 500 shown" />
        <StatTile
          icon={paths.db}
          label={t('usage.cacheRate')}
          value={`${stats.cacheRate}%`}
          note="of cacheable reads"
          tone={toneFor(stats.cacheRate, 60, 30, true)}
        />
        <StatTile
          icon={paths.clock}
          label={t('usage.latency')}
          value={`${stats.avgLatency.toLocaleString()} ms`}
          note="per request"
          tone={toneFor(stats.avgLatency, 2000, 5000)}
        />
      </section>

      <section className="card p-6">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-fp-ink">{t('usage.chartTitle')}</h3>
            <p className="text-xs text-fp-ink-3">{isAdmin ? 'All users' : 'Your usage'} · resets {usage.periodStart || 'monthly'}</p>
          </div>
          <button className="btn-ghost px-3 py-2 text-xs" onClick={onExport}>
            <Icon path={paths.download} size={13} strokeWidth={2.2} />
            {t('export.csv')}
          </button>
        </div>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#EEF1F6" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#8B99AD', fontSize: 11 }}
                axisLine={{ stroke: '#E6EAF1' }}
                tickLine={false}
              />
              <YAxis tick={{ fill: '#8B99AD', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                cursor={{ stroke: '#C6D4E8', strokeDasharray: '4 4' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E6EAF1',
                  boxShadow: '0 8px 24px rgba(15,27,45,0.10)',
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Total']}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2A78D6"
                strokeWidth={2}
                isAnimationActive={false}
                dot={{ r: 3.5, fill: '#2A78D6', strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {overview && overview.totals && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={paths.shield}
              label="Rate-limit rejections"
              value={String(overview.totals.rejected ?? 0)}
              note={`last ${overview.windowDays} days`}
              tone={toneFor(overview.totals.rejected ?? 0, 1, 10)}
            />
            <StatTile
              icon={paths.x}
              label="Errors"
              value={String(overview.totals.errors ?? 0)}
              note={`last ${overview.windowDays} days`}
              tone={toneFor(overview.totals.errors ?? 0, 1, 10)}
            />
            <StatTile
              icon={paths.clock}
              label="Cache-hit latency"
              value={`${(overview.totals.avg_cache_hit_ms ?? 0).toLocaleString()} ms`}
              note="answers served from cache"
              tone={toneFor(overview.totals.avg_cache_hit_ms ?? 0, 800, 2000)}
            />
            <StatTile
              icon={paths.spark}
              label="LLM vs tool time"
              value={`${Math.round((overview.totals.avg_llm_ms ?? 0) / 1000)}s / ${((overview.totals.avg_tool_ms ?? 0) / 1000).toFixed(1)}s`}
              note="avg per request (model / SAP tools)"
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="card p-6">
              <h3 className="mb-1 text-sm font-semibold text-fp-ink">Requests by tool</h3>
              <p className="mb-3 text-xs text-fp-ink-3">
                Which business capabilities are actually used · last {overview.windowDays} days
              </p>
              {overview.byTool.length === 0 && <div className="py-4 text-center text-xs text-fp-ink-3">No tool calls yet.</div>}
              <div className="space-y-2">
                {overview.byTool.map((row) => {
                  const max = Math.max(...overview.byTool.map((r) => r.calls), 1);
                  return (
                    <div key={row.tool} className="flex items-center gap-2">
                      <span className="w-44 shrink-0 truncate text-[11px] font-medium text-fp-ink-2">{row.tool}</span>
                      <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-fp-line/60">
                        <div
                          className="h-full rounded-md bg-fp-accent"
                          style={{ width: `${Math.max((row.calls / max) * 100, 2)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-fp-ink">
                        {row.calls}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="mb-1 text-sm font-semibold text-fp-ink">Top questions</h3>
              <p className="mb-3 text-xs text-fp-ink-3">
                Repeated questions are cache/dedupe candidates · last {overview.windowDays} days
              </p>
              {overview.topQuestions.length === 0 && (
                <div className="py-4 text-center text-xs text-fp-ink-3">No questions yet.</div>
              )}
              <div className="space-y-1.5">
                {overview.topQuestions.map((q) => (
                  <div key={q.question} className="flex items-center justify-between gap-3 rounded-xl bg-fp-bg px-3 py-2">
                    <span className="truncate text-xs text-fp-ink-2">{q.question}</span>
                    <span className="chip shrink-0 bg-fp-accent-soft text-fp-accent-dark">{q.times}×</span>
                  </div>
                ))}
              </div>
              {overview.byChannel.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-fp-line pt-3">
                  {overview.byChannel.map((c) => (
                    <span key={c.channel} className="chip border border-fp-line bg-fp-surface text-fp-ink-2">
                      {c.channel}: {c.requests}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {isAdmin && (
        <section className="card overflow-hidden">
          <div className="border-b border-fp-line px-6 py-4">
            <h3 className="text-sm font-semibold text-fp-ink">{t('usage.byUser')}</h3>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-fp-bg">
                <tr className="border-b border-fp-line">
                  <th className="table-head">Day</th>
                  <th className="table-head">User</th>
                  <th className="table-head">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.map((row, i) => (
                  <tr key={i} className="border-b border-fp-line last:border-0">
                    <td className="table-cell text-fp-ink-2">{String(row.day).slice(0, 10)}</td>
                    <td className="table-cell font-medium">{row.email}</td>
                    <td className="table-cell font-semibold">{Number(row.total_tokens).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-fp-good',
  warn: 'text-fp-warn',
  bad: 'text-fp-bad',
  neutral: 'text-fp-ink',
};

const TONE_BAR: Record<Tone, string> = {
  good: 'bg-fp-good',
  warn: 'bg-[#EDA100]',
  bad: 'bg-fp-bad',
  neutral: 'bg-fp-accent',
};

/** Traffic-light tone: green below the first bound, amber between, red above. */
function toneFor(value: number, warnAt: number, badAt: number, higherIsBetter = false): Tone {
  if (higherIsBetter) {
    if (value >= warnAt) return 'good';
    if (value >= badAt) return 'warn';
    return 'bad';
  }
  if (value < warnAt) return 'good';
  if (value <= badAt) return 'warn';
  return 'bad';
}

function StatTile({
  icon,
  label,
  value,
  note,
  tone = 'neutral',
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  tone?: Tone;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-fp-ink-3">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Icon path={icon} size={16} strokeWidth={2} />
      </div>
      <div className={`mt-2 text-[26px] font-semibold tracking-tight ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="mt-1.5 text-xs text-fp-ink-3">{note}</div>
    </div>
  );
}
