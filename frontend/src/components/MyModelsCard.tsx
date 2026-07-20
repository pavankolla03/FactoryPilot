import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Icon, paths } from './ui';

type UserModel = {
  id: string;
  name: string;
  base_url: string;
  model_id: string;
  purpose: 'chat' | 'critic';
  active: boolean;
  created_at: string;
  last_used_at: string | null;
};

/**
 * BYOM (beta, Phase M): register your own OpenAI-compatible models —
 * OpenAI, Azure, Groq, Ollama, vLLM, OpenRouter — with your own key.
 * Otto routes to your models first and falls back to the platform chain.
 */
export function MyModelsCard({ client }: { client: AxiosInstance }) {
  const [models, setModels] = useState<UserModel[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [purpose, setPurpose] = useState<'chat' | 'critic'>('chat');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await client.get('/api/auth/models');
      setModels(res.data);
    } catch {
      setModels([]);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setError('');
    if (!name.trim() || !baseUrl.trim() || !modelId.trim() || !apiKey.trim()) {
      return;
    }
    try {
      await client.post('/api/auth/models', {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        modelId: modelId.trim(),
        apiKey: apiKey.trim(),
        purpose,
      });
      setName('');
      setBaseUrl('');
      setModelId('');
      setApiKey('');
      await load();
    } catch (e) {
      const detail =
        (e as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data;
      setError(detail?.error?.message || String(detail?.message || 'failed to add model'));
    }
  }

  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fp-ink">
        My models
        <span className="chip bg-fp-accent-soft text-fp-accent-dark">Beta</span>
      </h3>
      <p className="mb-3 text-xs text-fp-ink-3">
        Bring your own model: any OpenAI-compatible endpoint (OpenAI, Azure, Groq, Ollama, vLLM, OpenRouter…).
        Otto routes to your active models first — your key, your bill, your data path — and falls back to the
        platform chain if your endpoint fails. Keys are stored encrypted and never shown again.
      </p>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input className="input py-2 text-xs" placeholder="Display name (e.g. my-gpt4o)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input py-2 text-xs" placeholder="Base URL (e.g. https://api.openai.com/v1)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <input className="input py-2 text-xs" placeholder="Model id (e.g. gpt-4o-mini)" value={modelId} onChange={(e) => setModelId(e.target.value)} />
        <input className="input py-2 text-xs" type="password" placeholder="API key (stored encrypted)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
      </div>
      <div className="mb-3 flex items-center gap-2 text-xs text-fp-ink-2">
        Use for
        <select className="input !w-56 py-2 text-xs" value={purpose} onChange={(e) => setPurpose(e.target.value as 'chat' | 'critic')}>
          <option value="chat">Chat & agents (Otto answers)</option>
          <option value="critic">Critic (plan reviews)</option>
        </select>
      </div>
      <button className="btn-primary px-3 py-2 text-xs" onClick={() => void add()}>
        <Icon path={paths.plus} size={12} strokeWidth={2.4} />
        Add model
      </button>
      {error && <div className="mt-2 rounded-lg bg-fp-bad-soft px-3 py-2 text-xs font-medium text-fp-bad">{error}</div>}

      {models.length > 0 && (
        <div className="mt-3 space-y-2">
          {models.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-fp-line px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fp-ink">
                  <span className="truncate">{m.name}</span>
                  <span className="chip bg-fp-bg text-fp-ink-2">{m.model_id}</span>
                  {m.purpose === 'critic' && <span className="chip bg-fp-warn-soft text-fp-warn">critic</span>}
                  {m.active && <span className="chip bg-fp-good-soft text-fp-good">routing</span>}
                </div>
                <div className="truncate text-[11px] text-fp-ink-3">
                  {m.base_url}
                  {m.last_used_at ? ` · last used ${new Date(m.last_used_at).toLocaleString()}` : ' · never used'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <label className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-fp-ink-2">
                  <input
                    type="checkbox"
                    checked={m.active}
                    onChange={(e) => {
                      void client.post(`/api/auth/models/${m.id}/toggle`, { active: e.target.checked }).then(load);
                    }}
                  />
                  Active
                </label>
                <button
                  className="grid h-7 w-7 place-items-center rounded-lg text-fp-ink-3 transition hover:bg-fp-bad-soft hover:text-fp-bad"
                  title="Delete"
                  onClick={() => void client.delete(`/api/auth/models/${m.id}`).then(load)}
                >
                  <Icon path={paths.x} size={12} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
