import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon, LogoMark, SourceChip, paths } from './ui';
import { useI18n } from '../i18n';

export type AgentStep = {
  id: string;
  tool: string;
  server: string;
  args?: Record<string, unknown>;
  ms?: number;
  cacheHit?: boolean;
  status: 'running' | 'ok' | 'error' | 'pending';
};

export type TurnStats = {
  elapsedMs: number;
  rounds: number;
  toolCount: number;
  model: string;
  tokens: number;
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
  source?: 'cache' | 'live';
  grounded?: boolean;
  steps?: AgentStep[];
  stats?: TurnStats;
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
  agentSteps,
  workingSince,
  chatInput,
  conversations,
  activeConversationId,
  onInput,
  onSend,
  onSuggestion,
  onOpenConversation,
  onNewChat,
  onFeedback,
}: {
  displayName: string;
  chatTurns: ChatTurn[];
  streaming: boolean;
  streamingText: string;
  agentSteps: AgentStep[];
  workingSince: number | null;
  chatInput: string;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggestion: (v: string) => void;
  onOpenConversation: (id: string) => void;
  onNewChat: () => void;
  onFeedback: (rating: 1 | -1) => void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatTurns.length, streamingText, agentSteps.length]);

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
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

      <div className="chat-canvas flex h-[calc(100vh-190px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#E8E6DA]">
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6">
          <div className="mx-auto w-full max-w-[720px] space-y-6">
            {chatTurns.length === 0 && !streaming && (
              <div className="flex min-h-[420px] flex-col items-center justify-center">
                <LogoMark size={48} />
                <h3 className="chat-serif mt-5 text-[22px] font-semibold tracking-tight text-[#1F1E1D]">
                  {t('chat.empty.title')}
                </h3>
                <p className="mt-1.5 max-w-sm text-center text-sm text-[#8A877C]">{t('chat.empty.subtitle')}</p>
                <div className="mt-7 flex max-w-xl flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chat-suggestion" onClick={() => onSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatTurns.map((turn, idx) =>
              turn.role === 'user' ? (
                <div key={idx} className="flex justify-end">
                  <div className="chat-user-block max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed">
                    {turn.text}
                  </div>
                </div>
              ) : (
                <div key={idx} className="flex gap-3.5">
                  <div className="shrink-0 pt-1">
                    <LogoMark size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[12px] font-semibold tracking-wide text-[#8A877C]">Otto</div>
                    <TurnActivity steps={turn.steps} stats={turn.stats} />
                    <AssistantBody text={turn.text} />
                    {turn.source && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <SourceChip source={turn.source} />
                        {turn.grounded === true && (
                          <span className="chip bg-fp-good-soft text-fp-good">Grounded in tool data</span>
                        )}
                        {turn.grounded === false && (
                          <span className="chip bg-fp-warn-soft text-fp-warn">No data source consulted</span>
                        )}
                        {turn.stats && turn.stats.elapsedMs > 0 && (
                          <span className="text-[11px] tabular-nums text-[#A5A294]">
                            {(turn.stats.elapsedMs / 1000).toFixed(1)}s
                            {turn.stats.model ? ` · ${prettyModel(turn.stats.model)}` : ''}
                            {turn.stats.tokens > 0 ? ` · ${turn.stats.tokens.toLocaleString()} tokens` : ''}
                          </span>
                        )}
                        <span className="ml-1 flex items-center gap-0.5">
                          <button
                            className="rounded-md px-1 text-[13px] opacity-40 transition hover:opacity-100"
                            title="Good answer"
                            onClick={() => onFeedback(1)}
                          >
                            👍
                          </button>
                          <button
                            className="rounded-md px-1 text-[13px] opacity-40 transition hover:opacity-100"
                            title="Bad answer"
                            onClick={() => onFeedback(-1)}
                          >
                            👎
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {streaming && (
              <div className="flex gap-3.5">
                <div className="shrink-0 pt-1">
                  <LogoMark size={28} animate />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-[12px] font-semibold tracking-wide text-[#8A877C]">Otto</div>
                  <LiveActivity steps={agentSteps} since={workingSince} writing={Boolean(streamingText)} />
                  {streamingText && (
                    <div className="chat-serif whitespace-pre-wrap">
                      {streamingText}
                      <span className="stream-cursor" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-1">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="chat-input-claude flex items-center gap-1.5 rounded-3xl p-2 pl-4 transition">
              <input
                className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-[#1F1E1D] outline-none placeholder:text-[#A5A294]"
                value={chatInput}
                onChange={(e) => onInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                placeholder={t('chat.placeholder')}
              />
              <BarcodeButton onScan={(code) => onInput(`show stock for material ${code}`)} />
              <MicButton onTranscript={onInput} />
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fp-accent text-white transition hover:bg-fp-accent-dark disabled:opacity-40"
                onClick={onSend}
                disabled={!chatInput.trim()}
                title={t('chat.send')}
              >
                <Icon path={paths.send} size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div className="mt-2 text-center text-[11px] text-[#A5A294]">{t('chat.footnote')}</div>
          </div>
        </div>
      </div>

    </section>
  );
}

const SERVER_LABEL: Record<string, string> = {
  inventory: 'MCP Inventory',
  'warehouse-ops': 'MCP Warehouse Ops',
  'mcp-inventory': 'MCP Inventory',
  'mcp-warehouse-ops': 'MCP Warehouse Ops',
  orchestrator: 'Orchestrator',
};

/** "openrouter(vendor/model:free)" or "vendor/model" -> "model". */
export function prettyModel(model: string) {
  const inner = model.match(/\(([^)]+)\)/)?.[1] ?? model;
  return inner.split('/').pop() || inner;
}

/** "getStockLevel" -> "Get stock level". */
function prettyToolName(tool: string) {
  const spaced = tool.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function compactArgs(args?: Record<string, unknown>) {
  if (!args || Object.keys(args).length === 0) {
    return '';
  }
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'running') {
    return <span className="fp-spinner shrink-0" />;
  }
  if (status === 'error') {
    return <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-fp-bad-soft text-[10px] font-bold text-fp-bad">!</span>;
  }
  if (status === 'pending') {
    return <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-fp-warn-soft text-[10px] font-bold text-fp-warn">⏸</span>;
  }
  return <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-fp-good-soft text-[10px] font-bold text-fp-good">✓</span>;
}

function StepRow({ step, showArgs }: { step: AgentStep; showArgs?: boolean }) {
  const args = showArgs ? compactArgs(step.args) : '';
  return (
    <div className="step-in py-1">
      <div className="flex items-center gap-2 text-[12.5px]">
        <StepStatusIcon status={step.status} />
        <span className="font-medium text-[#3D3C36]">{prettyToolName(step.tool)}</span>
        <span className="activity-chip">{SERVER_LABEL[step.server] || step.server}</span>
        {step.cacheHit && <span className="activity-chip text-fp-accent">cache</span>}
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[#A5A294]">
          {step.status === 'running'
            ? 'running…'
            : step.status === 'pending'
              ? 'awaiting approval'
              : step.ms != null
                ? `${(step.ms / 1000).toFixed(2)}s`
                : ''}
        </span>
      </div>
      {args && <div className="ml-6 mt-0.5 truncate text-[11px] text-[#A5A294]">{args}</div>}
    </div>
  );
}

/** Claude-style live "working" block: shimmer label, ticking timer, tool steps streaming in. */
function LiveActivity({ steps, since, writing }: { steps: AgentStep[]; since: number | null; writing: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = since ? Math.max(0, now - since) / 1000 : 0;
  const running = steps.find((s) => s.status === 'running');
  const label = writing ? 'Writing the answer' : running ? `Running ${prettyToolName(running.tool)}` : 'Thinking';

  return (
    <div className="activity-card mb-2.5 rounded-2xl px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="fp-spinner" />
        <span className="shimmer-text text-[12.5px] font-medium">{label}…</span>
        {since && <span className="ml-auto text-[11px] tabular-nums text-[#A5A294]">{elapsed.toFixed(1)}s</span>}
      </div>
      {steps.length > 0 && (
        <div className="mt-1.5 border-t border-[#E8E6DA] pt-1">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Collapsed one-line summary of a finished turn's agent work; expands to the full timeline. */
function TurnActivity({ steps, stats }: { steps?: AgentStep[]; stats?: TurnStats }) {
  const [open, setOpen] = useState(false);
  const hasSteps = Boolean(steps && steps.length > 0);
  if (!hasSteps && !stats) {
    return null;
  }
  if (!hasSteps && stats && stats.toolCount === 0 && stats.model === 'answer-cache') {
    return null; // instant dedupe-cache answers need no timeline
  }
  if (!hasSteps) {
    return null;
  }

  const seconds = stats ? (stats.elapsedMs / 1000).toFixed(1) : null;
  const summary = [
    seconds ? `Worked for ${seconds}s` : 'Worked',
    `${steps!.length} tool ${steps!.length === 1 ? 'call' : 'calls'}`,
    stats && stats.rounds > 1 ? `${stats.rounds} rounds` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] font-medium text-[#8A877C] transition hover:bg-[#EEEDE4] hover:text-[#56544D]"
        onClick={() => setOpen(!open)}
      >
        <span className={`inline-block text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {summary}
      </button>
      {open && (
        <div className="activity-card step-in mt-1.5 rounded-2xl px-3.5 py-1.5">
          {steps!.map((s) => (
            <StepRow key={s.id} step={s} showArgs />
          ))}
        </div>
      )}
    </div>
  );
}

/** Camera barcode scanning (BarcodeDetector API — Chrome/Android). */
function BarcodeButton({ onScan }: { onScan: (code: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const Detector = (window as unknown as { BarcodeDetector?: new (opts?: unknown) => any }).BarcodeDetector;
  if (!Detector) {
    return null;
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(async function tick() {
        const video = videoRef.current;
        if (!video || !streamRef.current) {
          return;
        }
        if (!video.srcObject) {
          video.srcObject = stream;
          await video.play();
        }
        try {
          const detector = new Detector!({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            onScan(String(codes[0].rawValue));
            stop();
            return;
          }
        } catch {
          /* keep scanning */
        }
        if (streamRef.current) {
          requestAnimationFrame(tick);
        }
      });
    } catch {
      setScanning(false);
    }
  }

  return (
    <>
      <button
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${
          scanning ? 'bg-fp-accent-soft text-fp-accent' : 'text-[#8A877C] hover:bg-[#EEEDE4] hover:text-[#1F1E1D]'
        }`}
        title="Scan a barcode"
        onClick={() => (scanning ? stop() : void start())}
      >
        <Icon path={paths.db} size={16} strokeWidth={2} />
      </button>
      {scanning && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70" onClick={stop}>
          <div className="overflow-hidden rounded-2xl">
            <video ref={videoRef} className="h-64 w-96 object-cover" muted playsInline />
            <div className="bg-fp-navy px-4 py-2 text-center text-xs text-white">
              Point the camera at a material barcode — tap anywhere to cancel
            </div>
          </div>
        </div>
      )}
    </>
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
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition ${
        listening ? 'bg-fp-bad-soft text-fp-bad' : 'text-[#8A877C] hover:bg-[#EEEDE4] hover:text-[#1F1E1D]'
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

/** Parses GFM tables out of markdown; returns chartable label/value pairs. */
function extractChartData(markdown: string): Array<{ title: string; rows: Array<{ label: string; value: number }> }> {
  const charts: Array<{ title: string; rows: Array<{ label: string; value: number }> }> = [];
  const lines = markdown.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = lines[i].split('|').map((c) => c.trim()).filter(Boolean);
      const rows: Array<{ label: string; value: number }> = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const cells = lines[j].split('|').map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 2) {
          const value = Number(String(cells[cells.length - 1]).replace(/[,%a-zA-Z\s]/g, ''));
          if (Number.isFinite(value) && cells[0]) {
            rows.push({ label: cells[0].replace(/\*\*/g, ''), value });
          }
        }
        j += 1;
      }
      if (rows.length >= 2 && rows.every((r) => Number.isFinite(r.value))) {
        charts.push({ title: header[0] || 'Breakdown', rows });
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return charts;
}

const CHART_LOCATION_COLORS: Record<string, string> = {
  receiving: '#2A78D6',
  inspection: '#4A3AA7',
  bulk: '#B87A00',
  packing: '#1B7F3B',
  shipping: '#D95926',
};

function InlineBarChart({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="mb-3 rounded-2xl border border-[#E8E6DA] bg-white p-4">
      <div className="space-y-2">
        {rows.map((row) => {
          const color = CHART_LOCATION_COLORS[row.label.toLowerCase().trim()] || '#2A78D6';
          return (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-right text-[11px] font-medium text-[#56544D]">
                {row.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded-md bg-[#F1F0E9]">
                <div
                  className="h-full rounded-md"
                  style={{ width: `${Math.max((Math.abs(row.value) / max) * 100, 2)}%`, background: color }}
                />
              </div>
              <span className="w-14 shrink-0 text-[11px] font-semibold tabular-nums text-[#262521]">
                {row.value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  const charts = extractChartData(text);

  return (
    <div>
      {charts.map((chart, i) => (
        <InlineBarChart key={i} rows={chart.rows} />
      ))}
      <div className="md-body chat-serif">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
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
