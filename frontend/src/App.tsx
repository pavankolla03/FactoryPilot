import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';
import { Landing } from './components/Landing';
import { ApprovalsPage, type ScheduledReport } from './components/ApprovalsPage';
import { AutonomyPage, type AgentGoal, type AgentMetrics, type AgentRun } from './components/AutonomyPage';
import { ApiKeysCard } from './components/ApiKeysCard';
import { CommandCenter } from './components/CommandCenter';
import { MyModelsCard } from './components/MyModelsCard';
import { AutopilotBar } from './components/AutopilotBar';
import { BoardPage } from './components/BoardPage';
import { AuthPage } from './components/AuthPages';
import { Sidebar, type Tab } from './components/Sidebar';
import {
  ChatPage,
  type AgentStep,
  type ChatTurn,
  type ConversationSummary,
  type StockAlert,
  type TurnStats,
} from './components/ChatPage';
import { ActivityPage } from './components/ActivityPage';
import { UsersPage, type AdminUser, type WarehousePolicy } from './components/UsersPage';
import { CachePoliciesCard } from './components/CachePoliciesCard';
import { BusinessObjectsCard } from './components/BusinessObjectsCard';
import { ConnectionsCard } from './components/ConnectionsCard';
import { WarehouseHealthCard } from './components/WarehouseHealthCard';
import { SuppliersCard } from './components/SuppliersCard';
import { SlottingCard } from './components/SlottingCard';
import { ScenarioStudioCard } from './components/ScenarioStudioCard';
import { StockoutRadarCard } from './components/StockoutRadarCard';
import { EsgCard } from './components/EsgCard';
import { AnalyticsPage, type AnalyticsOverview } from './components/AnalyticsPage';
import { Icon, PageHeader, paths } from './components/ui';
import { useI18n } from './i18n';

type UserRole = 'admin' | 'viewer';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL || window.location.origin;

type StoredSession = {
  token: string;
  displayName: string;
  role: UserRole;
  email: string;
  orgName?: string;
  orgJoinCode?: string;
};

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem('fp-session');
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function App() {
  const { t, lang, setLang } = useI18n();
  const [session, setSession] = useState<StoredSession | null>(loadSession);
  const [view, setView] = useState<'landing' | 'signin' | 'signup'>('landing');
  const token = session?.token || '';
  const displayName = session?.displayName || '';
  const role: UserRole = session?.role || 'viewer';
  const loggedIn = Boolean(session);
  const [chatInput, setChatInput] = useState('');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const agentStepsRef = useRef<AgentStep[]>([]);
  const [workingSince, setWorkingSince] = useState<number | null>(null);
  const chatStartRef = useRef(0);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50000, periodStart: '' });
  const [tab, setTab] = useState<Tab>('chat');
  const [tokenRows, setTokenRows] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [warehousePolicies, setWarehousePolicies] = useState<WarehousePolicy[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [agentGoals, setAgentGoals] = useState<AgentGoal[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState('');

  // Close the notifications popover on any click outside it.
  useEffect(() => {
    if (!bellOpen) {
      return;
    }
    function onDocClick(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [bellOpen]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 6000);
  }

  /** Wraps an admin action with visible success/error feedback. */
  async function withFeedback(action: () => Promise<void>, success: string) {
    try {
      await action();
      showToast(success);
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.response?.data?.message || error.message
        : 'something went wrong';
      showToast(`Failed: ${detail}`);
    }
  }

  const client = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL || undefined });
    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    instance.interceptors.response.use(
      (res) => res,
      (error) => {
        // Expired/invalid session: drop it and return to the landing page.
        if (axios.isAxiosError(error) && error.response?.status === 401 && !String(error.config?.url).includes('/auth/')) {
          logout();
        }
        return Promise.reject(error);
      },
    );
    return instance;
  }, [token]);

  function persistSession(next: StoredSession) {
    localStorage.setItem('fp-session', JSON.stringify(next));
    setSession(next);
  }

  function logout() {
    localStorage.removeItem('fp-session');
    setSession(null);
    setView('landing');
    setChatTurns([]);
    setPendingActions([]);
    setActiveConversationId(null);
    setTab('chat');
  }

  async function authenticate(
    mode: 'signin' | 'signup',
    fields: { email: string; password: string; displayName?: string; orgName?: string; joinCode?: string },
  ) {
    try {
      const res =
        mode === 'signup'
          ? await client.post('/api/auth/signup', {
              email: fields.email,
              displayName: fields.displayName,
              password: fields.password,
              ...(fields.orgName ? { orgName: fields.orgName } : {}),
              ...(fields.joinCode ? { joinCode: fields.joinCode } : {}),
            })
          : await client.post('/api/auth/login', { email: fields.email, password: fields.password });

      persistSession({
        token: res.data.token,
        displayName: res.data.user.display_name,
        role: res.data.user.role,
        email: res.data.user.email,
        orgName: res.data.organization?.name,
        orgJoinCode: res.data.organization?.join_code,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.response?.data?.message || error.message);
      }
      throw error;
    }
  }

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    const socket: Socket = io(WS_URL, {
      path: '/ws',
      auth: token ? { token } : undefined,
    });

    socket.on('chat:token', (payload: { conversationId: string; delta: string }) => {
      setStreaming(true);
      streamingTextRef.current += payload.delta;
      setStreamingText(streamingTextRef.current);
    });

    socket.on('chat:status', (payload: { kind: string } & AgentStep) => {
      if (payload.kind === 'tool_start') {
        const next = [...agentStepsRef.current, { ...payload, status: 'running' as const }];
        agentStepsRef.current = next;
        setAgentSteps(next);
      } else if (payload.kind === 'tool_end') {
        const existing = agentStepsRef.current.some((s) => s.id === payload.id);
        const next = existing
          ? agentStepsRef.current.map((s) => (s.id === payload.id ? { ...s, ...payload } : s))
          : [...agentStepsRef.current, payload];
        agentStepsRef.current = next;
        setAgentSteps(next);
      }
    });

    socket.on(
      'chat:done',
      (payload: {
        conversationId: string;
        source: 'cache' | 'live';
        grounded?: boolean;
        stats?: TurnStats;
        toolEvents?: AgentStep[];
      }) => {
        const finalText = streamingTextRef.current;
        const stats: TurnStats = payload.stats ?? {
          elapsedMs: chatStartRef.current ? Date.now() - chatStartRef.current : 0,
          rounds: 0,
          toolCount: agentStepsRef.current.length,
          model: '',
          tokens: 0,
        };
        const steps = payload.toolEvents?.length ? payload.toolEvents : agentStepsRef.current;
        if (finalText) {
          setChatTurns((prev) => [
            ...prev,
            { role: 'assistant', text: finalText, source: payload.source, grounded: payload.grounded, stats, steps },
          ]);
        }
        setStreaming(false);
        streamingTextRef.current = '';
        setStreamingText('');
        agentStepsRef.current = [];
        setAgentSteps([]);
        setWorkingSince(null);
        void loadConversations();
        void loadAlerts();
      },
    );

    socket.on('chat:pending_action', (payload: PendingAction) => {
      setPendingActions((prev) => [payload, ...prev.filter((a) => a.actionId !== payload.actionId)]);
    });

    socket.on('session_log:new', (payload: SessionLogEntry) => {
      // Admins are in both the user and admin rooms, so events can arrive twice.
      setSessionLogs((prev) => [payload, ...prev.filter((r) => r.id !== payload.id)].slice(0, 500));
    });

    socket.on('token_usage:snapshot', (payload: { used: number; limit: number; periodStart: string }) => {
      setUsage(payload);
    });

    socket.on('token_usage:update', (payload: { used: number; limit: number }) => {
      setUsage((prev) => ({ ...prev, used: payload.used, limit: payload.limit }));
    });

    socket.on('agent_run:update', (payload: AgentRun) => {
      setAgentRuns((prev) => {
        const rest = prev.filter((r) => r.id !== payload.id);
        return [payload, ...rest].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 25);
      });
    });

    socket.on('notification:new', (payload: AppNotification) => {
      setNotifications((prev) => [payload, ...prev.filter((n) => n.id !== payload.id)].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, [loggedIn, token]);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    void refreshUsage();
    void refreshTokenRows();
    void refreshLogs();
    void loadConversations();
    void loadAlerts();
    void loadNotifications();
    void loadAgents();
    if (role === 'admin') {
      void refreshUsers();
    }
  }, [loggedIn]);

  async function sendChat(message?: string) {
    const text = (message ?? chatInput).trim();
    if (!text) {
      return;
    }
    setChatTurns((prev) => [...prev, { role: 'user', text }]);
    setChatInput('');
    setStreaming(true);
    chatStartRef.current = Date.now();
    setWorkingSince(chatStartRef.current);
    agentStepsRef.current = [];
    setAgentSteps([]);
    try {
      const res = await client.post('/api/chat', {
        message: text,
        conversationId: activeConversationId ?? undefined,
      });
      if (res.data?.conversationId) {
        setActiveConversationId(res.data.conversationId);
      }
    } catch (error) {
      setStreaming(false);
      streamingTextRef.current = '';
      setStreamingText('');
      agentStepsRef.current = [];
      setAgentSteps([]);
      setWorkingSince(null);
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : 'request failed';
      setChatTurns((prev) => [...prev, { role: 'assistant', text: `I couldn't process that: ${detail}` }]);
    }
  }

  async function confirmAction(actionId: string) {
    try {
      await client.post('/api/chat/confirm-action', { actionId });
      setChatTurns((prev) => [
        ...prev,
        { role: 'assistant', text: 'Done — the operation was executed against SAP.', source: 'live' },
      ]);
    } catch (error) {
      const detail = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : 'confirmation failed';
      setChatTurns((prev) => [...prev, { role: 'assistant', text: `The operation was rejected: ${detail}` }]);
    }
    setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));
    void refreshUsage();
  }

  async function refreshUsage() {
    const res = await client.get('/api/me/usage');
    setUsage({ used: res.data.used, limit: res.data.limit, periodStart: res.data.periodStart });
  }

  async function refreshTokenRows() {
    const res = await client.get('/api/token-usage');
    setTokenRows(res.data);
    try {
      const overview = await client.get('/api/analytics/overview');
      setAnalytics(overview.data);
    } catch {
      // analytics endpoint may be unavailable mid-deploy — tiles simply hide
    }
  }

  async function refreshLogs() {
    const res = await client.get('/api/session-logs');
    setSessionLogs(res.data);
  }

  async function refreshUsers() {
    const res = await client.get('/api/admin/users');
    setUsers(res.data);
    const policies = await client.get('/api/admin/users/warehouse-policies/list');
    setWarehousePolicies(policies.data);
  }

  async function loadConversations() {
    const res = await client.get('/api/conversations');
    setConversations(res.data);
  }

  async function openConversation(id: string) {
    const res = await client.get(`/api/conversations/${id}/messages`);
    setActiveConversationId(id);
    setChatTurns(
      (res.data as Array<{ role: 'user' | 'assistant'; content: string }>).map((m) => ({
        role: m.role,
        text: m.content,
      })),
    );
  }

  function newChat() {
    setActiveConversationId(null);
    setChatTurns([]);
  }

  async function loadAlerts() {
    const res = await client.get('/api/alerts');
    setAlerts(res.data);
    const reports = await client.get('/api/reports');
    setSchedules(reports.data);
  }

  async function loadAgents() {
    const [goals, runs, metrics] = await Promise.all([
      client.get('/api/agents/goals'),
      client.get('/api/agents/runs'),
      client.get('/api/agents/metrics'),
    ]);
    setAgentGoals(goals.data);
    setAgentRuns(runs.data);
    setAgentMetrics(metrics.data);
  }

  async function deleteAlert(id: string) {
    await client.delete(`/api/alerts/${id}`);
    await loadAlerts();
  }

  async function loadNotifications() {
    const res = await client.get('/api/notifications');
    setNotifications(res.data);
  }

  async function markNotificationsRead() {
    await client.post('/api/notifications/mark-read');
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  }

  async function exportCsv(path: string, filename: string) {
    const res = await client.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!loggedIn) {
    if (view === 'signin' || view === 'signup') {
      return (
        <AuthPage
          mode={view}
          onSubmit={(fields) => authenticate(view, fields)}
          onSwitch={() => setView(view === 'signin' ? 'signup' : 'signin')}
          onBack={() => setView('landing')}
        />
      );
    }
    return <Landing onSignIn={() => setView('signin')} onSignUp={() => setView('signup')} />;
  }

  const pageMeta: Record<Tab, { title: string; subtitle: string }> = {
    chat: { title: t('page.chat.title'), subtitle: t('page.chat.subtitle') },
    board: { title: t('page.board.title'), subtitle: t('page.board.subtitle') },
    insights: { title: t('page.insights.title'), subtitle: t('page.insights.subtitle') },
    autonomy: { title: t('page.autonomy.title'), subtitle: t('page.autonomy.subtitle') },
    approvals: { title: t('page.approvals.title'), subtitle: t('page.approvals.subtitle') },
    usage: { title: t('page.usage.title'), subtitle: t('page.usage.subtitle') },
    logs: { title: t('page.logs.title'), subtitle: t('page.logs.subtitle') },
    connections: { title: t('page.connections.title'), subtitle: t('page.connections.subtitle') },
    users: { title: t('page.users.title'), subtitle: t('page.users.subtitle') },
  };
  const meta = pageMeta[tab];
  const quotaPct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex min-h-screen flex-col bg-fp-bg md:flex-row">
      <Sidebar
          orgName={session?.orgName}
        tab={tab}
        role={role}
        displayName={displayName}
        onTab={setTab}
        lang={lang}
        onLang={setLang}
        onLogout={logout}
        pendingCount={pendingActions.length}
      />

      <main className="min-w-0 flex-1 p-6 md:p-8">
        <PageHeader
          title={meta.title}
          subtitle={meta.subtitle}
          right={
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-full border border-fp-line bg-fp-surface px-3 py-1.5 text-xs font-medium text-fp-ink-2">
                <span className="live-dot" />
                {t('connected')}
              </span>
              <span className="flex items-center gap-2.5 rounded-full border border-fp-line bg-fp-surface px-3.5 py-1.5">
                <Icon path={paths.spark} size={14} strokeWidth={2} />
                <span className="text-xs font-semibold text-fp-ink">
                  {usage.used.toLocaleString()}
                  <span className="font-normal text-fp-ink-3"> / {usage.limit.toLocaleString()}</span>
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-fp-line">
                  <span
                    className={`block h-full rounded-full ${quotaPct > 85 ? 'bg-fp-bad' : 'bg-fp-accent'}`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </span>
              </span>

              <div className="relative" ref={bellRef}>
                <button
                  className="relative grid h-9 w-9 place-items-center rounded-full border border-fp-line bg-fp-surface text-fp-ink-2 transition hover:text-fp-ink"
                  onClick={() => setBellOpen((v) => !v)}
                >
                  <Icon path={paths.bell} size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-fp-bad px-1 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-11 z-30 w-96 overflow-hidden rounded-2xl border border-fp-line bg-fp-surface shadow-pop">
                    <div className="flex items-center justify-between border-b border-fp-line px-4 py-3">
                      <span className="text-sm font-semibold text-fp-ink">{t('notif.title')}</span>
                      {unreadCount > 0 && (
                        <button
                          className="text-xs font-semibold text-fp-accent hover:text-fp-accent-dark"
                          onClick={() => void markNotificationsRead()}
                        >
                          {t('notif.markRead')}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-auto">
                      {notifications.length === 0 && (
                        <div className="px-4 py-6 text-center text-xs text-fp-ink-3">{t('notif.empty')}</div>
                      )}
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`border-b border-fp-line px-4 py-3 last:border-0 ${n.read_at ? '' : 'bg-fp-accent-soft/40'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-semibold text-fp-ink">{n.title}</span>
                            <span className="shrink-0 text-[10px] text-fp-ink-3">
                              {new Date(n.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-fp-ink-2">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        />

        {tab === 'chat' && (
          <ChatPage
            displayName={displayName}
            chatTurns={chatTurns}
            streaming={streaming}
            streamingText={streamingText}
            agentSteps={agentSteps}
            workingSince={workingSince}
            chatInput={chatInput}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onInput={setChatInput}
            onSend={() => void sendChat()}
            onSuggestion={(s) => void sendChat(s)}
            onOpenConversation={(id) => void openConversation(id)}
            onNewChat={newChat}
            onFeedback={(rating) =>
              void client
                .post('/api/agents/feedback', { conversationId: activeConversationId ?? undefined, rating })
                .then(() => showToast(rating === 1 ? 'Thanks for the feedback!' : 'Noted — this helps Otto improve.'))
                .catch(() => undefined)
            }
          />
        )}

        {tab === 'board' && <BoardPage client={client} onProposed={showToast} />}

        {tab === 'insights' && (
          <div>
            <WarehouseHealthCard
              client={client}
              onExplain={(wh) => {
                setTab('chat');
                void sendChat(
                  `Explain the health score for warehouse ${wh}: what is the biggest risk driving it down, and what should I do about it?`,
                );
              }}
            />
            <StockoutRadarCard
              client={client}
              onReorder={(wh, mat, qty) => {
                setTab('chat');
                void sendChat(`Draft a purchase requisition for ${qty} units of ${mat} in warehouse ${wh}.`);
              }}
            />
            <ScenarioStudioCard client={client} />
            <SuppliersCard
              client={client}
              onExplain={() => {
                setTab('chat');
                void sendChat(
                  'Which supplier is our biggest reliability risk right now, and why? Consider on-time rate, lead time and any overdue POs.',
                );
              }}
            />
            <SlottingCard
              client={client}
              onToast={showToast}
              onExplain={(wh) => {
                setTab('chat');
                void sendChat(
                  `Analyze slotting for warehouse ${wh}: which fast-moving materials are in the wrong location and how should we reslot them to cut picker walking?`,
                );
              }}
            />
            <EsgCard
              client={client}
              onExport={() => void exportCsv('/api/ops/esg/export.csv', 'factorypilot-esg.csv')}
            />
          </div>
        )}

        {tab === 'autonomy' && (
          <div>
            {role === 'admin' && (
              <AutopilotBar
                client={client}
                onDispatched={() => {
                  showToast('Autopilot patrol dispatched — watch the runs list.');
                  void loadAgents();
                }}
              />
            )}
            <AutonomyPage
            goals={agentGoals}
            runs={agentRuns}
            onCreateGoal={(g) =>
              withFeedback(async () => {
                await client.post('/api/agents/goals', g);
                await loadAgents();
              }, `Goal created — the ${g.agent === 'cycle_count' ? 'cycle-count planner' : g.agent === 'rebalance' ? 'rebalancer' : g.agent === 'po_followup' ? 'PO follow-up agent' : g.agent === 'forecast' ? 'forecast agent' : 'replenishment agent'} now watches WH ${g.warehouseId}.`)
            }
            onToggleGoal={(id, active) =>
              withFeedback(async () => {
                await client.patch(`/api/agents/goals/${id}`, { active });
                await loadAgents();
              }, active ? 'Goal activated.' : 'Goal paused (kill switch).')
            }
            onRunNow={(warehouseId, goalId) =>
              withFeedback(async () => {
                await client.post('/api/agents/run', { warehouseId, goalId });
                await loadAgents();
              }, 'Run started — watch the timeline update live.')
            }
            onSimulate={async (warehouseId, threshold) => {
              try {
                const res = await client.post('/api/agents/simulate', { warehouseId, threshold });
                const d = res.data;
                showToast(
                  d.lowPositions === 0
                    ? `Dry run WH ${warehouseId}: all positions healthy — the agent would do nothing.`
                    : `Dry run WH ${warehouseId}: would order ${d.totalUnitsToOrder} units across ${d.projected.filter((p: { suggestedOrderQty: number }) => p.suggestedOrderQty > 0).length} material(s). Zero writes performed.`,
                );
              } catch {
                showToast('Dry run failed — check your write scope for this warehouse.');
              }
            }}
            onScenario={async ({ warehouseId, demandMultiplier, horizonDays }) => {
              try {
                const res = await client.post('/api/agents/simulate', { warehouseId, demandMultiplier, horizonDays });
                return res.data;
              } catch {
                showToast('Scenario projection failed — check your write scope for this warehouse.');
                return null;
              }
            }}
            metrics={agentMetrics}
          />
          </div>
        )}

        {tab === 'approvals' && (
          <ApprovalsPage
            pendingActions={pendingActions}
            alerts={alerts}
            schedules={schedules}
            onConfirm={(id) => void confirmAction(id)}
            onCancel={(id) => setPendingActions((prev) => prev.filter((x) => x.actionId !== id))}
            onDeleteAlert={(id) => void deleteAlert(id)}
            onDeleteSchedule={(id) =>
              withFeedback(async () => {
                await client.delete(`/api/reports/${id}`);
                await loadAlerts();
              }, 'Scheduled report removed.')
            }
          />
        )}

        {tab === 'usage' && (
          <div className="space-y-5">
            <AnalyticsPage
              usage={usage}
              tokenRows={tokenRows}
              sessionLogs={sessionLogs}
              overview={analytics}
              isAdmin={role === 'admin'}
              onExport={() => void exportCsv('/api/token-usage/export.csv', 'factorypilot-token-usage.csv')}
            />
            {role === 'admin' && <CommandCenter client={client} />}
            <MyModelsCard client={client} />
            <ApiKeysCard client={client} />
          </div>
        )}

        {tab === 'logs' && (
          <ActivityPage
            sessionLogs={sessionLogs}
            client={client}
            onExport={() => void exportCsv('/api/session-logs/export.csv', 'factorypilot-activity.csv')}
          />
        )}

        {tab === 'connections' && role === 'admin' && (
          <div className="space-y-5">
            <ConnectionsCard client={client} onSaved={showToast} />
            <BusinessObjectsCard client={client} onSaved={showToast} />
          </div>
        )}

        {tab === 'users' && role === 'admin' && (
          <UsersPage
            users={users}
            onCreate={(u) =>
              withFeedback(async () => {
                await client.post('/api/admin/users', u);
                await refreshUsers();
              }, `Invited ${u.email} — they activate by signing up with that email.`)
            }
            onDelete={(id) =>
              withFeedback(async () => {
                await client.delete(`/api/admin/users/${id}`);
                await refreshUsers();
              }, 'User removed.')
            }
            onQuota={(id, limits) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/${id}/quota`, limits);
                await refreshUsers();
              }, 'Token limits updated.')
            }
            onScopes={(id, scopes) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/${id}/scopes`, { scopes });
                await refreshUsers();
              }, 'Warehouse access updated.')
            }
            onPolicy={(id, maxQty) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/${id}/policy`, { auto_approve_max_qty: maxQty });
                await refreshUsers();
              }, 'Auto-approve policy saved.')
            }
            onMakerChecker={(id, enabled) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/${id}/policy`, { maker_checker: enabled });
                await refreshUsers();
              }, enabled ? 'Maker-checker enabled.' : 'Maker-checker disabled.')
            }
            onWebhook={(id, url) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/${id}/webhook`, { webhook_url: url });
                await refreshUsers();
              }, url ? 'Webhook saved — notifications will be delivered there.' : 'Webhook removed.')
            }
            cachePoliciesSlot={<CachePoliciesCard client={client} onSaved={showToast} />}
            warehousePolicies={warehousePolicies}
            onWarehousePolicy={(warehouseId, maxQty, makerChecker) =>
              withFeedback(async () => {
                await client.patch(`/api/admin/users/warehouse-policies/${warehouseId}`, {
                  auto_approve_max_qty: maxQty,
                  maker_checker: makerChecker,
                });
                await refreshUsers();
              }, `Policy for warehouse ${warehouseId} saved.`)
            }
          />
        )}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl bg-fp-navy px-4 py-3 text-sm text-white shadow-pop">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
