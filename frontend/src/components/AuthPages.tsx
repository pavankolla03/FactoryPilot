import { useState } from 'react';
import { Icon, LogoMark, paths } from './ui';

export function AuthPage({
  mode,
  onSubmit,
  onSwitch,
  onBack,
}: {
  mode: 'signin' | 'signup';
  onSubmit: (fields: { email: string; password: string; displayName?: string }) => Promise<void>;
  onSwitch: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';
  const valid = email.includes('@') && password.length >= (isSignup ? 8 : 1) && (!isSignup || displayName.trim());

  async function submit() {
    if (!valid || busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ email, password, displayName: isSignup ? displayName : undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-fp-navy px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 20%, rgba(42,120,214,0.4) 0, transparent 45%), radial-gradient(circle at 80% 80%, rgba(42,120,214,0.2) 0, transparent 45%)',
        }}
      />

      <div className="relative w-full max-w-md">
        <button className="mb-6 flex items-center gap-2 text-sm font-medium text-[#93A3BB] transition hover:text-white" onClick={onBack}>
          ← Back
        </button>

        <div className="rounded-3xl bg-fp-surface p-8 shadow-pop">
          <div className="flex items-center gap-3">
            <LogoMark size={36} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-fp-ink">
                {isSignup ? 'Create your workspace' : 'Welcome back'}
              </h1>
              <p className="text-xs text-fp-ink-3">
                {isSignup
                  ? 'The first account becomes the workspace administrator.'
                  : 'Sign in to your FactoryPilot workspace.'}
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            {isSignup && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                  Full name
                </label>
                <input
                  className="input"
                  placeholder="Jane Miller"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                Work email
              </label>
              <input
                className="input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-fp-ink-3">
                Password
              </label>
              <input
                className="input"
                type="password"
                placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-fp-bad-soft px-3.5 py-2.5 text-xs font-medium text-fp-bad">{error}</div>
            )}

            <button className="btn-primary w-full py-3" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
              {!busy && <Icon path={paths.send} size={15} strokeWidth={2.2} />}
            </button>
          </div>

          <div className="mt-6 border-t border-fp-line pt-5 text-center text-sm text-fp-ink-3">
            {isSignup ? 'Already have an account?' : 'New to FactoryPilot?'}{' '}
            <button className="font-semibold text-fp-accent transition hover:text-fp-accent-dark" onClick={onSwitch}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
