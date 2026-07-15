import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PendingAction, SessionLogEntry } from '@manufacturing-agent/shared';

type UserRole = 'admin' | 'viewer';

type ChatTurn = {
  conversationId: string;
  text: string;
  source: 'cache' | 'live';
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL || window.location.origin;

function App() {
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState('admin@factory.local');
  const [displayName, setDisplayName] = useState('Factory Admin');
  const [role, setRole] = useState<UserRole>('admin');
  const [loggedIn, setLoggedIn] = useState(false);
  const [chatInput, setChatInput] = useState('show stock for material MAT-10023456 in warehouse 1010');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  // Ref mirror of streamingText so socket handlers read the latest value
  // without the effect depending on it (which would reconnect per delta).
  const streamingTextRef = useRef('');
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [usage, setUsage] = useState({ used: 0, limit: 50000, periodStart: '' });
  const [tab, setTab] = useState<'chat' | 'usage' | 'logs' | 'users'>('chat');
  const [tokenRows, setTokenRows] = useState<any[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [users, setUsers] = useState<any[]>([]);

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
      setStreamingConversationId(payload.conversationId);
      streamingTextRef.current += payload.delta;
      setStreamingText(streamingTextRef.current);
    });

    socket.on('chat:done', (payload: { conversationId: string; source: 'cache' | 'live' }) => {
      const finalText = streamingTextRef.current;
      setChatTurns((prev) => [
        ...prev,
        { conversationId: payload.conversationId, text: finalText, source: payload.source },
      ]);
      setStreamingConversationId(null);
      streamingTextRef.current = '';
      setStreamingText('');
    });

    socket.on('chat:pending_action', (payload: PendingAction) => {
      setPendingActions((prev) => [payload, ...prev]);
    });

    socket.on('session_log:new', (payload: SessionLogEntry) => {
      setSessionLogs((prev) => [payload, ...prev].slice(0, 200));
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

  async function sendChat() {
    if (!chatInput.trim()) {
      return;
    }
    await client.post('/api/chat', { message: chatInput });
    setChatInput('');
  }

  async function confirmAction(actionId: string) {
    await client.post('/api/chat/confirm-action', { actionId });
    setPendingActions((prev) => prev.filter((a) => a.actionId !== actionId));
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
      <div className="min-h-screen grid place-items-center p-6 bg-fp-bg-main">
        <div className="card w-full max-w-xl p-8">
          <h1 className="font-heading text-3xl mb-2 text-fp-text-primary">FactoryPilot Login</h1>
          <p className="text-fp-text-muted mb-6">
            Local mock login. In production, XSUAA login is handled by approuter.
          </p>
          <div className="grid gap-3">
            <input
              className="border border-fp-border-light rounded-xl p-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border border-fp-border-light rounded-xl p-3"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <select
              className="border border-fp-border-light rounded-xl p-3"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="admin">admin</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              className="bg-fp-accent-orange text-fp-text-primary rounded-lg p-3 font-bold transition hover:brightness-95"
              onClick={() => void mockLogin()}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fp-bg-main text-fp-text-primary">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full md:w-60 md:min-h-screen bg-fp-bg-sidebar p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-7 h-7 rounded-md bg-fp-accent-orange" />
            <div className="text-white text-xl font-bold tracking-tight">FactoryPilot</div>
          </div>

          <nav className="flex-1 space-y-2">
            <SidebarNavItem icon={<IconChat />} active={tab === 'chat'} label="Chat" onClick={() => setTab('chat')} />
            <SidebarNavItem icon={<IconUsage />} active={tab === 'usage'} label="Token Usage" onClick={() => setTab('usage')} />
            <SidebarNavItem icon={<IconLogs />} active={tab === 'logs'} label="Session Log" onClick={() => setTab('logs')} />
            {role === 'admin' && (
              <SidebarNavItem
                icon={<IconUsers />}
                active={tab === 'users'}
                label="User Management"
                onClick={() => setTab('users')}
              />
            )}
          </nav>

          <div className="pt-4 border-t border-[#242833] flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-fp-accent-orange text-fp-bg-sidebar flex items-center justify-center font-bold">
              {displayName
                .split(' ')
                .map((x) => x[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">{displayName}</div>
              <div className="text-fp-text-muted text-xs uppercase tracking-wide">{role}</div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-screen bg-fp-bg-main p-6 md:p-8">
          <header className="pb-5 border-b border-fp-border-light flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-bold text-fp-text-primary leading-tight">FactoryPilot Agent Console</h1>
              <p className="text-fp-text-muted text-sm">SAP Manufacturing and Warehouse assistant</p>
            </div>
            <div className="flex gap-2 items-center">
              <span className="pill bg-[#E9EAEC] text-fp-text-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                <IconUsage />
                {usage.used.toLocaleString()} / {usage.limit.toLocaleString()} tokens
              </span>
              <span className="pill bg-fp-badge-peach text-[#9A5C16] px-4 py-2 text-sm capitalize font-bold">{role}</span>
            </div>
          </header>

          <div className="pt-6">
            {tab === 'chat' && (
              <section className="grid lg:grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-4">
                  <div className="card p-5 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="panel-title">Conversation</h3>
                    </div>

                    <div className="h-[430px] overflow-auto space-y-3 pr-1">
                      {chatTurns.map((turn, idx) => (
                        <div key={`${turn.conversationId}-${idx}`} className="card p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="text-xs text-fp-text-muted">Conversation {turn.conversationId}</div>
                            {turn.source === 'cache' && (
                              <span className="pill bg-fp-badge-green-bg text-fp-badge-green-text inline-flex items-center gap-2">
                                <IconBadge />
                                From cache
                              </span>
                            )}
                          </div>
                          <ChatBody text={turn.text} />
                        </div>
                      ))}

                      {streamingConversationId && (
                        <div className="card p-4 border border-fp-accent-orange">
                          <div className="text-xs text-fp-text-muted mb-2">Streaming {streamingConversationId}</div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingText}</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2 items-stretch">
                      <div className="chat-input-shell flex-1 flex items-center px-4">
                        <input
                          className="w-full bg-transparent text-sm text-white placeholder:text-[#A7ACB7] py-3 outline-none"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask about stock or request an operation"
                        />
                      </div>
                      <button
                        className="rounded-lg px-5 py-3 bg-fp-badge-peach text-fp-text-primary font-bold inline-flex items-center gap-2"
                        onClick={() => void sendChat()}
                      >
                        <IconSend />
                        Send
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="card p-5 md:p-6">
                    <h3 className="panel-title mb-3">Pending Actions</h3>
                    {pendingActions.length === 0 && (
                      <p className="text-sm text-fp-text-muted">No pending write actions.</p>
                    )}

                    <div className="space-y-3">
                      {pendingActions.map((action) => (
                        <div key={action.actionId} className="bg-white border-2 border-fp-accent-orange rounded-2xl p-4">
                          <div className="font-bold text-base text-fp-text-primary capitalize">{action.tool}</div>
                          <div className="text-sm text-fp-text-muted mt-1 mb-3">{action.humanSummary}</div>
                          <div className="rounded-lg border border-fp-border-light bg-[#FBFCFD] p-3 mb-3">
                            <pre className="text-xs text-fp-text-primary overflow-auto">{JSON.stringify(action.params, null, 2)}</pre>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              className="rounded-lg px-6 py-3 bg-fp-accent-orange text-fp-text-primary font-bold"
                              onClick={() => void confirmAction(action.actionId)}
                            >
                              Confirm
                            </button>
                            <button
                              className="rounded-lg px-6 py-3 bg-white border border-fp-border-light text-fp-text-primary font-semibold"
                              onClick={() => setPendingActions((prev) => prev.filter((x) => x.actionId !== action.actionId))}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === 'usage' && (
              <section className="card p-5 md:p-6 h-[560px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="panel-title">Token Usage</h3>
                </div>
                <ResponsiveContainer width="100%" height="92%">
                  <LineChart data={tokenRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" tick={{ fill: '#8A8F98', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#8A8F98', fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total_tokens" stroke="#F5A623" name="total_tokens" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            )}

            {tab === 'logs' && (
              <section className="card p-5 md:p-6">
                <h3 className="panel-title mb-4">Session Logs</h3>
                <div className="overflow-auto max-h-[560px] rounded-xl border border-fp-border-light">
                  <table className="w-full text-sm bg-white">
                    <thead>
                      <tr className="text-left border-b border-fp-border-light bg-[#FBFCFD]">
                        <th className="p-3 font-semibold text-fp-text-muted">Time</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Status</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Tools</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Cache</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionLogs.map((row) => (
                        <tr key={row.id} className="border-b border-fp-border-light">
                          <td className="p-3 text-fp-text-primary">{new Date(row.created_at).toLocaleString()}</td>
                          <td className="p-3 text-fp-text-primary">{row.status}</td>
                          <td className="p-3 text-fp-text-primary">{JSON.stringify(row.tools_invoked_json)}</td>
                          <td className="p-3 text-fp-text-primary">{row.cache_status}</td>
                          <td className="p-3 text-fp-text-primary">{row.latency_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === 'users' && role === 'admin' && (
              <section className="card p-5 md:p-6">
                <h3 className="panel-title mb-4">User Management</h3>
                <div className="overflow-auto max-h-[560px] rounded-xl border border-fp-border-light">
                  <table className="w-full text-sm bg-white">
                    <thead>
                      <tr className="border-b border-fp-border-light text-left bg-[#FBFCFD]">
                        <th className="p-3 font-semibold text-fp-text-muted">Email</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Display Name</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Role</th>
                        <th className="p-3 font-semibold text-fp-text-muted">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr className="border-b border-fp-border-light" key={u.id}>
                          <td className="p-3 text-fp-text-primary">{u.email}</td>
                          <td className="p-3 text-fp-text-primary">{u.display_name}</td>
                          <td className="p-3 text-fp-text-primary capitalize">{u.role}</td>
                          <td className="p-3">
                            <button
                              className="bg-white border border-fp-border-light text-fp-text-primary rounded-lg px-3 py-2 font-medium"
                              onClick={async () => {
                                await client.delete(`/api/admin/users/${u.id}`);
                                await refreshUsers();
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function ChatBody({ text }: { text: string }) {
  try {
    const parsed = JSON.parse(text) as { records?: Array<Record<string, unknown>> };
    const records = parsed.records || [];

    if (records.length === 0) {
      return <p className="text-sm text-fp-text-primary whitespace-pre-wrap">{text}</p>;
    }

    return (
      <div className="space-y-3">
        {records.slice(0, 8).map((record, idx) => (
          <div key={idx} className="rounded-xl border border-fp-border-light p-3 bg-white">
            {Object.entries(record).map(([k, v]) => (
              <div key={k} className="kv-row">
                <span className="kv-label">{k}</span>
                <span className="kv-value">{String(v)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  } catch {
    return <p className="text-sm text-fp-text-primary whitespace-pre-wrap">{text}</p>;
  }
}

function SidebarNavItem({
  icon,
  active,
  label,
  onClick,
}: {
  icon: ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`sidebar-nav-item w-full ${active ? 'active' : ''}`} onClick={onClick}>
      <span className={active ? 'text-fp-accent-orange' : 'text-fp-text-muted'}>{icon}</span>
      {label}
    </button>
  );
}

function IconChat() {
  return <OutlineIcon path="M4 5h16v10H8l-4 4V5z" />;
}

function IconUsage() {
  return <OutlineIcon path="M5 19V9m7 10V5m7 14v-7" />;
}

function IconLogs() {
  return <OutlineIcon path="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" />;
}

function IconUsers() {
  return <OutlineIcon path="M8 11a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6zM4 20a4 4 0 018 0m4 0a4 4 0 018 0" />;
}

function IconBadge() {
  return <OutlineIcon path="M6 6h12v12H6z" size={14} />;
}

function IconSend() {
  return <OutlineIcon path="M4 12h14M12 4l8 8-8 8" size={16} />;
}

function OutlineIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default App;
