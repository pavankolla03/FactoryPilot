import { Fragment, useState } from 'react';
import type { AxiosInstance } from 'axios';
import type { SessionLogEntry } from '@manufacturing-agent/shared';
import { EmptyState, Icon, StatusChip, paths } from './ui';
import { useI18n } from '../i18n';

type DetailMessage = {
  role: string;
  content: string;
  tool_calls_json: unknown;
  created_at: string;
};

export function ActivityPage({
  sessionLogs,
  onExport,
  client,
}: {
  sessionLogs: SessionLogEntry[];
  onExport: () => void;
  client: AxiosInstance;
}) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, DetailMessage[] | 'loading' | 'none'>>({});

  async function toggleRow(row: SessionLogEntry) {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (detail[row.id]) {
      return;
    }
    if (!row.conversation_id) {
      setDetail((prev) => ({ ...prev, [row.id]: 'none' }));
      return;
    }
    setDetail((prev) => ({ ...prev, [row.id]: 'loading' }));
    try {
      const res = await client.get(`/api/conversations/${row.conversation_id}/messages`, {
        params: { includeTools: 1 },
      });
      setDetail((prev) => ({ ...prev, [row.id]: res.data }));
    } catch {
      setDetail((prev) => ({ ...prev, [row.id]: 'none' }));
    }
  }
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-fp-line px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold text-fp-ink">{t('logs.title')}</h3>
          <p className="text-xs text-fp-ink-3">{t('logs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost px-3 py-2 text-xs" onClick={onExport}>
            <Icon path={paths.download} size={13} strokeWidth={2.2} />
            {t('export.csv')}
          </button>
          <span className="flex items-center gap-2 text-xs font-medium text-fp-good">
            <span className="live-dot" />
            {t('logs.live')}
          </span>
        </div>
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
                <Fragment key={row.id}>
                <tr
                  className="cursor-pointer border-b border-fp-line transition last:border-0 hover:bg-fp-bg/60"
                  onClick={() => void toggleRow(row)}
                >
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
                {expandedId === row.id && (
                  <tr className="border-b border-fp-line bg-fp-bg/40">
                    <td colSpan={7} className="px-6 py-4">
                      <AuditDetail row={row} detail={detail[row.id]} />
                    </td>
                  </tr>
                )}
                </Fragment>
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


function AuditDetail({ row, detail }: { row: SessionLogEntry; detail?: DetailMessage[] | 'loading' | 'none' }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">Full request</div>
        <div className="mt-1 text-sm text-fp-ink">{row.query_text}</div>
      </div>

      {detail === 'loading' && <div className="text-xs text-fp-ink-3">Loading tool calls…</div>}
      {detail === 'none' && (
        <div className="text-xs text-fp-ink-3">No conversation detail available for this entry.</div>
      )}
      {Array.isArray(detail) && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
            Tool calls & results
          </div>
          <div className="space-y-1.5">
            {detail
              .filter((m) => m.role === 'tool' || (m.role === 'assistant' && Array.isArray(m.tool_calls_json)))
              .slice(-8)
              .map((m, i) =>
                m.role === 'assistant' ? (
                  <div key={i} className="rounded-lg bg-fp-accent-soft/50 px-3 py-2 text-xs">
                    <span className="font-semibold text-fp-accent-dark">called:</span>{' '}
                    {(m.tool_calls_json as Array<{ name: string; arguments: unknown }>)
                      .map((tc) => `${tc.name}(${JSON.stringify(tc.arguments)})`)
                      .join(', ')}
                  </div>
                ) : (
                  <pre key={i} className="max-h-40 overflow-auto rounded-lg bg-fp-surface px-3 py-2 text-[11px] leading-relaxed text-fp-ink-2 border border-fp-line">
                    {formatToolResult(m.content)}
                  </pre>
                ),
              )}
            {detail.filter((m) => m.role === 'tool').length === 0 && (
              <div className="text-xs text-fp-ink-3">No tools were invoked in this conversation turn.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatToolResult(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2).slice(0, 1500);
  } catch {
    return content.slice(0, 1500);
  }
}
