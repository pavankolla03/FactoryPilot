import type { SessionLogEntry } from '@manufacturing-agent/shared';
import { EmptyState, StatusChip, paths } from './ui';

export function ActivityPage({ sessionLogs }: { sessionLogs: SessionLogEntry[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-fp-line px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-fp-ink">Request activity</h3>
          <p className="text-xs text-fp-ink-3">Every agent request — updated in real time</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-fp-good">
          <span className="live-dot" />
          Live
        </span>
      </div>

      {sessionLogs.length === 0 ? (
        <EmptyState icon={paths.logs} title="No activity yet" hint="Requests appear here the moment they happen." />
      ) : (
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-fp-bg">
              <tr className="border-b border-fp-line">
                <th className="table-head">Time</th>
                <th className="table-head">Request</th>
                <th className="table-head">Status</th>
                <th className="table-head">Tools</th>
                <th className="table-head">Cache</th>
                <th className="table-head">Tokens</th>
                <th className="table-head">Latency</th>
              </tr>
            </thead>
            <tbody>
              {sessionLogs.map((row) => (
                <tr key={row.id} className="border-b border-fp-line transition last:border-0 hover:bg-fp-bg/60">
                  <td className="table-cell whitespace-nowrap text-fp-ink-2">
                    {new Date(row.created_at).toLocaleTimeString()}
                    <div className="text-[11px] text-fp-ink-3">{new Date(row.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="table-cell max-w-[280px]">
                    <div className="truncate font-medium" title={row.query_text}>
                      {row.query_text}
                    </div>
                  </td>
                  <td className="table-cell">
                    <StatusChip status={row.status} />
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {toolList(row.tools_invoked_json).map((tool, i) => (
                        <span key={i} className="chip bg-fp-bg text-fp-ink-2">
                          {tool}
                        </span>
                      ))}
                      {toolList(row.tools_invoked_json).length === 0 && <span className="text-xs text-fp-ink-3">—</span>}
                    </div>
                  </td>
                  <td className="table-cell">
                    <CacheCell status={row.cache_status} />
                  </td>
                  <td className="table-cell font-medium">{Number(row.tokens_used).toLocaleString()}</td>
                  <td className="table-cell whitespace-nowrap text-fp-ink-2">{row.latency_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function toolList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function CacheCell({ status }: { status: string }) {
  if (status === 'hit') {
    return <span className="chip bg-fp-accent-soft text-fp-accent-dark">Hit</span>;
  }
  if (status === 'miss') {
    return <span className="chip bg-fp-bg text-fp-ink-2">Miss</span>;
  }
  return <span className="text-xs text-fp-ink-3">—</span>;
}
