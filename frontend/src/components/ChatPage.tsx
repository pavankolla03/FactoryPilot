import { useEffect, useRef, useState } from 'react';
import type { PendingAction } from '@manufacturing-agent/shared';
import { EmptyState, Icon, LogoMark, SourceChip, initialsOf, paths } from './ui';
import { useI18n } from '../i18n';

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  source?: 'cache' | 'live';
};

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  last_activity: string | null;
  message_count: number;
};

export type StockAlert = {
  id: string;
  warehouse_id: string;
  material_id: string;
  threshold: number;
  triggered: boolean;
};

const SUGGESTIONS = [
  'Show stock for material MAT-10023456 in warehouse 1010',
  'Give me a summary of warehouse 1010',
  'Which materials are running low in warehouse 1030?',
  'Move product P123 from packing to shipping in warehouse 1010 qty 5',
  'Alert me when MAT-10023456 in warehouse 1010 drops below 100',
  'Show open purchase orders for warehouse 1010',
];

export function ChatPage({
  displayName,
  chatTurns,
  streaming,
  streamingText,
  chatInput,
  pendingActions,
  conversations,
  activeConversationId,
  alerts,
  onInput,
  onSend,
  onSuggestion,
  onConfirm,
  onCancel,
  onOpenConversation,
  onNewChat,
  onDeleteAlert,
}: {
  displayName: string;
  chatTurns: ChatTurn[];
  streaming: boolean;
  streamingText: string;
  chatInput: string;
  pendingActions: PendingAction[];
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  alerts: StockAlert[];
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggestion: (v: string) => void;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  onOpenConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteAlert: (id: string) => void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatTurns.length, streamingText, pendingActions.length]);

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <div className="card hidden max-h-[calc(100vh-190px)] flex-col overflow-hidden xl:flex">
        <div className="flex items-center justify-between border-b border-fp-line px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
            {t('chat.conversations')}
          </span>
          <button
            className="flex items-center gap-1 rounded-lg bg-fp-accent-soft px-2 py-1 text-[11px] font-semibold text-fp-accent-dark transition hover:bg-fp-accent hover:text-white"
            onClick={onNewChat}
          >
            <Icon path={paths.plus} size={11} strokeWidth={2.6} />
            {t('chat.newChat')}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {conversations.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-fp-ink-3">—</div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition ${
                c.id === activeConversationId ? 'bg-fp-accent-soft' : 'hover:bg-fp-bg'
              }`}
              onClick={() => onOpenConversation(c.id)}
            >
              <div className="truncate text-[13px] font-medium text-fp-ink">{c.title}</div>
              <div className="mt-0.5 text-[11px] text-fp-ink-3">
                {new Date(c.last_activity || c.created_at).toLocaleDateString()} · {c.message_count}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card flex h-[calc(100vh-190px)] min-h-[520px] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-auto p-6">
          {chatTurns.length === 0 && !streaming && (
            <div className="flex h-full flex-col items-center justify-center">
              <LogoMark size={44} />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-fp-ink">{t('chat.empty.title')}</h3>
              <p className="mt-1 max-w-sm text-center text-sm text-fp-ink-3">{t('chat.empty.subtitle')}</p>
              <div className="mt-6 flex max-w-xl flex-wrap justify-center gap-2">
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
                <div className="max-w-[82%]">
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
              <div className="max-w-[82%]">
                <div className="rounded-2xl rounded-tl-md border border-fp-line bg-fp-bg px-4 py-3 text-sm leading-relaxed text-fp-ink">
                  {streamingText || t('chat.working')}
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
              placeholder={t('chat.placeholder')}
            />
            <MicButton onTranscript={onInput} />
            <button className="btn-primary px-5 py-3" onClick={onSend} disabled={!chatInput.trim()}>
              <Icon path={paths.send} size={16} strokeWidth={2.2} />
              {t('chat.send')}
            </button>
          </div>
          <div className="mt-2 px-1 text-[11px] text-fp-ink-3">{t('chat.footnote')}</div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fp-ink">{t('approvals.title')}</h3>
            {pendingActions.length > 0 && (
              <span className="chip bg-fp-warn-soft text-fp-warn">
                {pendingActions.length} {t('approvals.awaiting')}
              </span>
            )}
          </div>

          {pendingActions.length === 0 ? (
            <EmptyState icon={paths.shield} title={t('approvals.empty.title')} hint={t('approvals.empty.hint')} />
          ) : (
            <div className="space-y-3">
              {pendingActions.map((action) => (
                <ApprovalCard key={action.actionId} action={action} onConfirm={onConfirm} onCancel={onCancel} />
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fp-ink">{t('alerts.title')}</h3>
            {alerts.length > 0 && <span className="chip bg-fp-accent-soft text-fp-accent-dark">{alerts.length}</span>}
          </div>

          {alerts.length === 0 ? (
            <p className="text-xs leading-relaxed text-fp-ink-3">{t('alerts.empty')}</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-fp-line px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-fp-ink">
                      {a.triggered && <span className="h-2 w-2 shrink-0 rounded-full bg-fp-bad" />}
                      <span className="truncate">{a.material_id}</span>
                    </div>
                    <div className="text-[11px] text-fp-ink-3">
                      WH {a.warehouse_id} · {t('alerts.below')} {a.threshold}
                    </div>
                  </div>
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fp-ink-3 transition hover:bg-fp-bad-soft hover:text-fp-bad"
                    onClick={() => onDeleteAlert(a.id)}
                  >
                    <Icon path={paths.x} size={12} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ApprovalCard({
  action,
  onConfirm,
  onCancel,
}: {
  action: PendingAction;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const { t } = useI18n();
  const steps =
    action.tool === 'batch'
      ? ((action.params.steps || []) as Array<{ tool: string; params: Record<string, unknown> }>)
      : [{ tool: action.tool, params: action.params }];

  return (
    <div className="overflow-hidden rounded-2xl border border-fp-line">
      <div className="border-l-[3px] border-fp-accent bg-fp-accent-soft/40 px-4 py-3">
        <div className="text-sm font-semibold text-fp-ink">
          {action.tool === 'batch' ? `${steps.length} ${t('approvals.steps')}` : prettyTool(action.tool)}
        </div>
        <div className="mt-0.5 text-xs text-fp-ink-3">{t('approvals.requires')}</div>
      </div>
      <div className="space-y-3 px-4 py-3">
        {steps.map((step, i) => (
          <div key={i}>
            {steps.length > 1 && (
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">
                {i + 1}. {prettyTool(step.tool)}
              </div>
            )}
            <div className="space-y-1.5">
              {Object.entries(step.params).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-fp-ink-3">{prettyKey(k)}</span>
                  <span className="font-semibold text-fp-ink">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <button className="btn-primary flex-1 py-2 text-xs" onClick={() => onConfirm(action.actionId)}>
          <Icon path={paths.check} size={13} strokeWidth={2.4} />
          {t('approvals.approve')}
        </button>
        <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => onCancel(action.actionId)}>
          {t('approvals.dismiss')}
        </button>
      </div>
    </div>
  );
}

function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { lang } = useI18n();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const SpeechRecognition =
    (window as unknown as { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any })
      .SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition!();
    recognition.lang = lang === 'de' ? 'de-DE' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = Array.from(event.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((r) => r[0].transcript)
        .join('');
      onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
        listening
          ? 'border-fp-bad bg-fp-bad-soft text-fp-bad'
          : 'border-fp-line bg-fp-surface text-fp-ink-2 hover:border-fp-accent hover:text-fp-accent'
      }`}
      title="Voice input"
      onClick={toggle}
    >
      <Icon path={paths.mic} size={17} strokeWidth={2} />
    </button>
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
    const columns = Object.keys(records[0]).filter((c) => typeof records[0][c] !== 'object');
    const qtyColumn = columns.find((c) => ['quantity', 'qty', 'totalStock', 'inboundQty'].includes(c));
    const maxQty = qtyColumn ? Math.max(...records.map((r) => Number(r[qtyColumn]) || 0), 1) : 1;

    return (
      <div className="overflow-hidden rounded-2xl rounded-tl-md border border-fp-line bg-fp-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-fp-line bg-fp-bg">
                {columns.map((c) => (
                  <th
                    key={c}
                    className="px-3.5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-fp-ink-3"
                  >
                    {prettyKey(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 12).map((r, i) => (
                <tr key={i} className="border-b border-fp-line last:border-0">
                  {columns.map((c) => (
                    <td key={c} className="px-3.5 py-2.5 font-medium text-fp-ink">
                      {c === qtyColumn ? (
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right tabular-nums">{String(r[c] ?? 0)}</span>
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-fp-line">
                            <span
                              className="block h-full rounded-full bg-fp-accent"
                              style={{ width: `${Math.round((Number(r[c]) / maxQty) * 100)}%` }}
                            />
                          </span>
                        </div>
                      ) : (
                        String(r[c] ?? '—')
                      )}
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
