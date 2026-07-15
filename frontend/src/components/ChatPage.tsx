import { useEffect, useRef } from 'react';
import type { PendingAction } from '@manufacturing-agent/shared';
import { EmptyState, Icon, LogoMark, SourceChip, initialsOf, paths } from './ui';

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  source?: 'cache' | 'live';
};

const SUGGESTIONS = [
  'Show stock for material MAT-10023456 in warehouse 1010',
  'Move product P123 from packing to shipping in warehouse 1010 qty 5',
  'What stock movements happened in warehouse 1010 in the last 24 hours?',
];

export function ChatPage({
  displayName,
  chatTurns,
  streaming,
  streamingText,
  chatInput,
  pendingActions,
  onInput,
  onSend,
  onSuggestion,
  onConfirm,
  onCancel,
}: {
  displayName: string;
  chatTurns: ChatTurn[];
  streaming: boolean;
  streamingText: string;
  chatInput: string;
  pendingActions: PendingAction[];
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggestion: (v: string) => void;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatTurns.length, streamingText, pendingActions.length]);

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="card flex h-[calc(100vh-190px)] min-h-[520px] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-auto p-6">
          {chatTurns.length === 0 && !streaming && (
            <div className="flex h-full flex-col items-center justify-center">
              <LogoMark size={44} />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-fp-ink">
                Ask anything about your warehouses
              </h3>
              <p className="mt-1 max-w-sm text-center text-sm text-fp-ink-3">
                Stock levels, material master data, movements — or ask the agent to move stock for you.
              </p>
              <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="rounded-full border border-fp-line bg-fp-surface px-3.5 py-2 text-xs font-medium text-fp-ink-2 transition hover:border-fp-accent hover:text-fp-accent"
                    onClick={() => onSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatTurns.map((turn, idx) =>
            turn.role === 'user' ? (
              <div key={idx} className="flex justify-end gap-3">
                <div className="max-w-[75%] rounded-2xl rounded-br-md bg-fp-navy px-4 py-3 text-sm leading-relaxed text-white">
                  {turn.text}
                </div>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fp-accent text-[10px] font-bold text-white">
                  {initialsOf(displayName)}
                </div>
              </div>
            ) : (
              <div key={idx} className="flex gap-3">
                <div className="shrink-0 pt-0.5">
                  <LogoMark size={30} />
                </div>
                <div className="max-w-[80%]">
                  <AssistantBody text={turn.text} />
                  {turn.source && (
                    <div className="mt-2">
                      <SourceChip source={turn.source} />
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {streaming && (
            <div className="flex gap-3">
              <div className="shrink-0 pt-0.5">
                <LogoMark size={30} />
              </div>
              <div className="max-w-[80%]">
                <div className="rounded-2xl rounded-tl-md border border-fp-line bg-fp-bg px-4 py-3 text-sm leading-relaxed text-fp-ink">
                  {streamingText || 'Working on it'}
                  <span className="stream-cursor" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-fp-line p-4">
          <div className="flex items-center gap-2.5">
            <input
              className="input py-3"
              value={chatInput}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder="Ask about stock, materials, or request an operation…"
            />
            <button className="btn-primary px-5 py-3" onClick={onSend} disabled={!chatInput.trim()}>
              <Icon path={paths.send} size={16} strokeWidth={2.2} />
              Send
            </button>
          </div>
          <div className="mt-2 px-1 text-[11px] text-fp-ink-3">
            Write operations always require your confirmation before touching SAP.
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fp-ink">Pending approvals</h3>
          {pendingActions.length > 0 && (
            <span className="chip bg-fp-warn-soft text-fp-warn">{pendingActions.length} awaiting</span>
          )}
        </div>

        {pendingActions.length === 0 ? (
          <EmptyState
            icon={paths.shield}
            title="Nothing to approve"
            hint="When the agent proposes a write to SAP, it appears here for your sign-off first."
          />
        ) : (
          <div className="space-y-3">
            {pendingActions.map((action) => (
              <div key={action.actionId} className="overflow-hidden rounded-2xl border border-fp-line">
                <div className="border-l-[3px] border-fp-accent bg-fp-accent-soft/40 px-4 py-3">
                  <div className="text-sm font-semibold text-fp-ink">{prettyTool(action.tool)}</div>
                  <div className="mt-0.5 text-xs text-fp-ink-3">Requires confirmation</div>
                </div>
                <div className="space-y-1.5 px-4 py-3">
                  {Object.entries(action.params).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-fp-ink-3">{prettyKey(k)}</span>
                      <span className="font-semibold text-fp-ink">{String(v)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  <button className="btn-primary flex-1 py-2 text-xs" onClick={() => onConfirm(action.actionId)}>
                    <Icon path={paths.check} size={13} strokeWidth={2.4} />
                    Approve
                  </button>
                  <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => onCancel(action.actionId)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function prettyTool(tool: string) {
  const map: Record<string, string> = {
    moveStock: 'Move stock between locations',
  };
  return map[tool] || tool;
}

function prettyKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace('Id', 'ID');
}

function AssistantBody({ text }: { text: string }) {
  const records = extractRecords(text);

  if (records && records.length > 0) {
    const columns = Object.keys(records[0]);
    return (
      <div className="overflow-hidden rounded-2xl rounded-tl-md border border-fp-line bg-fp-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-fp-line bg-fp-bg">
                {columns.map((c) => (
                  <th key={c} className="px-3.5 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px] text-fp-ink-3">
                    {prettyKey(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-b border-fp-line last:border-0">
                  {columns.map((c) => (
                    <td key={c} className="px-3.5 py-2.5 font-medium text-fp-ink">
                      {String(r[c] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-fp-line bg-fp-bg px-4 py-3 text-sm leading-relaxed text-fp-ink">
      {text}
    </div>
  );
}

function extractRecords(text: string): Array<Record<string, unknown>> | null {
  try {
    const parsed = JSON.parse(text) as { records?: Array<Record<string, unknown>> };
    if (Array.isArray(parsed.records)) {
      return parsed.records;
    }
    return null;
  } catch {
    return null;
  }
}
