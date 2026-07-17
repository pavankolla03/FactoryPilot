import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';
import { Landing } from './components/Landing';
import { AuthPage } from './components/AuthPages';
import { Sidebar, type Tab } from './components/Sidebar';
import { ChatPage, type ChatTurn, type ConversationSummary, type StockAlert } from './components/ChatPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { ActivityPage } from './components/ActivityPage';
import { UsersPage, type AdminUser, type WarehousePolicy } from './components/UsersPage';
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
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50000, periodStart: '' });
  const [tab, setTab] = useState<Tab>('chat');
  const [tokenRows, setTokenRows] = useState<any[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [warehousePolicies, setWarehousePolicies] = useState<WarehousePolicy[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

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

  async function authenticate(mode: 'signin' | 'signup', fields: { email: string; password: string; displayName?: string }) {
    try {
      const res =
        mode === 'signup'
          ? await client.post('/api/auth/signup', {
              email: fields.email,
              displayName: fields.displayName,
              password: fields.password,
            })
          : await client.post('/api/auth/login', { email: fields.email, password: fields.password });

      persistSession({
        token: res.data.token,
        displayName: res.data.user.display_name,
        role: res.data.user.role,
        email: res.data.user.email,
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

    socket.on('chat:done', (payload: { conversationId: string; source: 'cache' | 'live'; grounded?: boolean }) => {
      const finalText = streamingTextRef.current;
      if (finalText) {
        setChatTurns((prev) => [
          ...prev,
          { role: 'assistant', text: finalText, source: payload.source, grounded: payload.grounded },
        ]);
      }
      setStreaming(false);
      streamingTextRef.current = '';
      setStreamingText('');
      void loadConversations();
      void loadAlerts();
    });

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
    usage: { title: t('page.usage.title'), subtitle: t('page.usage.subtitle') },
    logs: { title: t('page.logs.title'), subtitle: t('page.logs.subtitle') },
    users: { title: t('page.users.title'), subtitle: t('page.users.subtitle') },
  };
  const meta = pageMeta[tab];
  const quotaPct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="flex min-h-screen flex-col bg-fp-bg md:flex-row">
      <Sidebar
        tab={tab}
        role={role}
        displayName={displayName}
        onTab={setTab}
        lang={lang}
        onLang={setLang}
        onLogout={logout}
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

              <div className="relative">
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
            chatInput={chatInput}
            pendingActions={pendingActions}
            conversations={conversations}
            activeConversationId={activeConversationId}
            alerts={alerts}
            onInput={setChatInput}
            onSend={() => void sendChat()}
            onSuggestion={(s) => void sendChat(s)}
            onConfirm={(id) => void confirmAction(id)}
            onCancel={(id) => setPendingActions((prev) => prev.filter((x) => x.actionId !== id))}
            onOpenConversation={(id) => void openConversation(id)}
            onNewChat={newChat}
            onDeleteAlert={(id) => void deleteAlert(id)}
          />
        )}

        {tab === 'usage' && (
          <AnalyticsPage
            usage={usage}
            tokenRows={tokenRows}
            sessionLogs={sessionLogs}
            isAdmin={role === 'admin'}
            onExport={() => void exportCsv('/api/token-usage/export.csv', 'factorypilot-token-usage.csv')}
          />
        )}

        {tab === 'logs' && (
          <ActivityPage
            sessionLogs={sessionLogs}
            onExport={() => void exportCsv('/api/session-logs/export.csv', 'factorypilot-activity.csv')}
          />
        )}

        {tab === 'users' && role === 'admin' && (
          <UsersPage
            users={users}
            onCreate={async (u) => {
              await client.post('/api/admin/users', u);
              await refreshUsers();
            }}
            onDelete={async (id) => {
              await client.delete(`/api/admin/users/${id}`);
              await refreshUsers();
            }}
            onQuota={async (id, limit) => {
              await client.patch(`/api/admin/users/${id}/quota`, { monthly_token_limit: limit });
              await refreshUsers();
            }}
            onScopes={async (id, scopes) => {
              await client.patch(`/api/admin/users/${id}/scopes`, { scopes });
              await refreshUsers();
            }}
            onPolicy={async (id, maxQty) => {
              await client.patch(`/api/admin/users/${id}/policy`, { auto_approve_max_qty: maxQty });
              await refreshUsers();
            }}
            onMakerChecker={async (id, enabled) => {
              await client.patch(`/api/admin/users/${id}/policy`, { maker_checker: enabled });
              await refreshUsers();
            }}
            onWebhook={async (id, url) => {
              await client.patch(`/api/admin/users/${id}/webhook`, { webhook_url: url });
              await refreshUsers();
            }}
            warehousePolicies={warehousePolicies}
            onWarehousePolicy={async (warehouseId, maxQty, makerChecker) => {
              await client.patch(`/api/admin/users/warehouse-policies/${warehouseId}`, {
                auto_approve_max_qty: maxQty,
                maker_checker: makerChecker,
              });
              await refreshUsers();
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
