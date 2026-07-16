import { Icon, LogoMark, paths } from './ui';

const SERVICES = [
  {
    icon: paths.chat,
    title: 'Conversational warehouse operations',
    text: 'Ask about stock, materials, movements, and purchase orders in plain language — the agent calls your SAP APIs and answers with live data.',
  },
  {
    icon: paths.shield,
    title: 'Human-in-the-loop writes',
    text: 'Every write to SAP is proposed first and executed only after sign-off. Auto-approve thresholds put you — not the model — in control.',
  },
  {
    icon: paths.bell,
    title: 'Proactive stock monitoring',
    text: 'Set alerts in one sentence. FactoryPilot watches stock levels continuously and notifies you the moment a threshold is crossed.',
  },
  {
    icon: paths.chart,
    title: 'Cost governance built in',
    text: 'Per-user monthly token budgets, live usage dashboards, and a smart cache that keeps repeat questions off your SAP backend entirely.',
  },
  {
    icon: paths.logs,
    title: 'Full auditability',
    text: 'Every request, tool call, cache hit, and approval lands in a live audit trail — exportable to CSV for your compliance team.',
  },
  {
    icon: paths.db,
    title: 'SAP-native architecture',
    text: 'XSUAA single sign-on, per-warehouse authorizations, MCP tool servers on Cloud Foundry, Integration Suite in the middle. Your tenant, your data.',
  },
];

export function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div className="min-h-screen bg-fp-navy">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <LogoMark size={34} />
          <span className="text-[17px] font-semibold tracking-tight text-white">FactoryPilot</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl px-4 py-2 text-sm font-semibold text-[#ADBBD0] transition hover:text-white" onClick={onSignIn}>
            Sign in
          </button>
          <button className="btn-primary px-4 py-2" onClick={onSignUp}>
            Get started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 20%, rgba(42,120,214,0.4) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(42,120,214,0.22) 0, transparent 45%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-[#93A3BB]">
            <span className="live-dot" />
            AI Agent for SAP Manufacturing &amp; Warehousing
          </div>
          <h1 className="mx-auto max-w-3xl text-[44px] font-semibold leading-[1.1] tracking-tight text-white md:text-[56px]">
            Your warehouse,
            <br />
            in plain language.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[#ADBBD0]">
            FactoryPilot puts an LLM agent in front of your SAP S/4HANA — read stock, move products, watch
            thresholds, and audit everything. On your BTP tenant, with the model of your choice.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <button className="btn-primary px-6 py-3 text-[15px]" onClick={onSignUp}>
              Get started free
              <Icon path={paths.send} size={15} strokeWidth={2.2} />
            </button>
            <button
              className="rounded-xl border border-white/15 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/5"
              onClick={onSignIn}
            >
              Sign in
            </button>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['9+', 'SAP tools the agent can call'],
              ['100%', 'writes gated by approval'],
              ['0 €', 'LLM cost on free-tier models'],
              ['1 min', 'stock alert check interval'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
                <div className="mt-1 text-xs leading-relaxed text-[#93A3BB]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="rounded-t-[32px] bg-fp-bg px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[32px] font-semibold tracking-tight text-fp-ink">What FactoryPilot does</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fp-ink-3">
              Everything an operations team needs to talk to SAP — with the governance an IT team demands.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="card p-6">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-fp-accent-soft text-fp-accent">
                  <Icon path={s.icon} size={20} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-fp-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fp-ink-2">{s.text}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mt-20">
            <h2 className="text-center text-[32px] font-semibold tracking-tight text-fp-ink">How it works</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-4">
              {[
                ['1', 'You ask', '"Move 20 units of P123 from packing to shipping in warehouse 1010."'],
                ['2', 'The agent plans', 'An LLM picks the right SAP tool via MCP — scoped to the warehouses you may access.'],
                ['3', 'You approve', 'Writes wait for your sign-off. Reads stream back instantly, cached for repeat questions.'],
                ['4', 'SAP executes', 'Calls flow through Integration Suite to S/4HANA. Every step lands in the audit trail.'],
              ].map(([step, title, text]) => (
                <div key={step} className="relative rounded-2xl border border-fp-line bg-fp-surface p-6">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-fp-navy text-sm font-bold text-white">
                    {step}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold text-fp-ink">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-fp-ink-2">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-20 overflow-hidden rounded-3xl bg-fp-navy px-8 py-14 text-center">
            <h2 className="text-[28px] font-semibold tracking-tight text-white">
              Ready to talk to your warehouse?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-[#ADBBD0]">
              Create an account in 30 seconds. The first account becomes your workspace administrator.
            </p>
            <button className="btn-primary mx-auto mt-7 px-6 py-3 text-[15px]" onClick={onSignUp}>
              Get started free
              <Icon path={paths.send} size={15} strokeWidth={2.2} />
            </button>
          </div>

          <footer className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-fp-line pt-8 text-xs text-fp-ink-3 md:flex-row">
            <div className="flex items-center gap-2">
              <LogoMark size={22} />
              <span className="font-semibold text-fp-ink-2">FactoryPilot</span>
            </div>
            <div>SAP BTP · Cloud Foundry · Integration Suite · MCP · Postgres · Redis</div>
          </footer>
        </div>
      </section>
    </div>
  );
}
