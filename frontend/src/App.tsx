import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';
import { Login } from './components/Login';
import { Sidebar, type Tab } from './components/Sidebar';
import { ChatPage, type ChatTurn } from './components/ChatPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { ActivityPage } from './components/ActivityPage';
import { UsersPage, type AdminUser } from './components/UsersPage';
import { Icon, PageHeader, paths } from './components/ui';

type UserRole = 'admin' | 'viewer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL || window.location.origin;

const PAGE_META: Record<Tab, { title: string; subtitle: string }> = {
  chat: { title: 'Assistant', subtitle: 'Ask about stock, materials, and movements — or operate the warehouse.' },
  usage: { title: 'Usage & Cost', subtitle: 'Token consumption, budgets, and efficiency at a glance.' },
  logs: { title: 'Activity', subtitle: 'A live audit trail of every request the agent handled.' },
  users: { title: 'Access Control', subtitle: 'Who can see and operate which warehouse, and on what budget.' },
};

function App() {
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('admin@factory.local');
  const [displayName, setDisplayName] = useState('Factory Admin');
  const [role, setRole] = useState<UserRole>('admin');
  const [loggedIn, setLoggedIn] = useState(false);
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

  const client = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL || undefined });
    instance.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    return instance;
  }, [token]);

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

    socket.on('chat:done', (payload: { conversationId: string; source: 'cache' | 'live' }) => {
      const finalText = streamingTextRef.current;
      if (finalText) {
        setChatTurns((prev) => [...prev, { role: 'assistant', text: finalText, source: payload.source }]);
      }
      setStreaming(false);
      streamingTextRef.current = '';
      setStreamingText('');
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
    if (role === 'admin') {
      void refreshUsers();
    }
  }, [loggedIn]);

  async function mockLogin() {
    const res = await client.post('/api/auth/mock-login', {
      email,
      displayName,
      role,
    });
    setToken(res.data.token);
    setLoggedIn(true);
  }

  async function sendChat(message?: string) {
    const text = (message ?? chatInput).trim();
    if (!text) {
      return;
    }
    setChatTurns((prev) => [...prev, { role: 'user', text }]);
    setChatInput('');
    setStreaming(true);
    try {
      await client.post('/api/chat', { message: text });
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
      setChatTurns((prev) => [...prev, { role: 'assistant', text: 'Done — the operation was executed against SAP.', source: 'live' }]);
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
  }

  if (!loggedIn) {
    return (
      <Login
        email={email}
        displayName={displayName}
        role={role}
        onEmail={setEmail}
        onDisplayName={setDisplayName}
        onRole={setRole}
        onSubmit={() => void mockLogin()}
      />
    );
  }

  const meta = PAGE_META[tab];
  const quotaPct = usage.limit ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-fp-bg md:flex-row">
      <Sidebar tab={tab} role={role} displayName={displayName} onTab={setTab} />

      <main className="min-w-0 flex-1 p-6 md:p-8">
        <PageHeader
          title={meta.title}
          subtitle={meta.subtitle}
          right={
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-2 rounded-full border border-fp-line bg-fp-surface px-3 py-1.5 text-xs font-medium text-fp-ink-2">
                <span className="live-dot" />
                Connected
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
            onInput={setChatInput}
            onSend={() => void sendChat()}
            onSuggestion={(s) => void sendChat(s)}
            onConfirm={(id) => void confirmAction(id)}
            onCancel={(id) => setPendingActions((prev) => prev.filter((x) => x.actionId !== id))}
          />
        )}

        {tab === 'usage' && (
          <AnalyticsPage usage={usage} tokenRows={tokenRows} sessionLogs={sessionLogs} isAdmin={role === 'admin'} />
        )}

        {tab === 'logs' && <ActivityPage sessionLogs={sessionLogs} />}

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
          />
        )}
      </main>
    </div>
  );
}

export default App;
