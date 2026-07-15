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

type TokenRow = { user_id: string; email: string; day: string; total_tokens: number };

export function AnalyticsPage({
  usage,
  tokenRows,
  sessionLogs,
  isAdmin,
}: {
  usage: { used: number; limit: number; periodStart: string };
  tokenRows: TokenRow[];
  sessionLogs: SessionLogEntry[];
  isAdmin: boolean;
}) {
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
            <span className="text-xs font-semibold uppercase tracking-wider text-fp-ink-3">Tokens this month</span>
            <Icon path={paths.spark} size={16} strokeWidth={2} />
          </div>
          <div className="mt-2 text-[26px] font-semibold tracking-tight text-fp-ink">
            {usage.used.toLocaleString()}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fp-line">
            <div className="h-full rounded-full bg-fp-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-xs text-fp-ink-3">
            {pct}% of {usage.limit.toLocaleString()} budget
          </div>
        </div>

        <StatTile icon={paths.chat} label="Requests logged" value={stats.requests.toLocaleString()} note="last 500 shown" />
        <StatTile icon={paths.db} label="Cache hit rate" value={`${stats.cacheRate}%`} note="of cacheable reads" />
        <StatTile icon={paths.clock} label="Avg. latency" value={`${stats.avgLatency.toLocaleString()} ms`} note="per request" />
      </section>

      <section className="card p-6">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-fp-ink">Token consumption per day</h3>
            <p className="text-xs text-fp-ink-3">{isAdmin ? 'All users' : 'Your usage'} · resets {usage.periodStart || 'monthly'}</p>
          </div>
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

      {isAdmin && (
        <section className="card overflow-hidden">
          <div className="border-b border-fp-line px-6 py-4">
            <h3 className="text-sm font-semibold text-fp-ink">Usage by user and day</h3>
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

function StatTile({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-fp-ink-3">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Icon path={icon} size={16} strokeWidth={2} />
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-tight text-fp-ink">{value}</div>
      <div className="mt-1.5 text-xs text-fp-ink-3">{note}</div>
    </div>
  );
}
