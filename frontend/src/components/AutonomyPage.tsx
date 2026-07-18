import { useState } from 'react';
import { EmptyState, Icon, paths } from './ui';

export type AgentGoal = {
  id: string;
  warehouse_id: string;
  threshold: number;
  autonomy: 'observe' | 'propose' | 'act';
  daily_budget_qty: number;
  active: boolean;
  last_run_at: string | null;
};

export type AgentRun = {
  id: string;
  warehouse_id: string;
  goal_text: string;
  status: string;
  steps: Array<{ at: string; type: string; detail: string; status: string }>;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
};

const WAREHOUSES = ['1010', '1020', '1030', '1040', '1050'];

const STATUS_STYLE: Record<string, string> = {
  running: 'bg-fp-accent-soft text-fp-accent-dark',
  waiting_approval: 'bg-fp-warn-soft text-fp-warn',
  completed: 'bg-fp-good-soft text-fp-good',
  failed: 'bg-fp-bad-soft text-fp-bad',
};

const STEP_ICON: Record<string, string> = {
  observe: paths.chart,
  plan: paths.logs,
  act: paths.bolt,
  approval: paths.shield,
  verify: paths.check,
  info: paths.chat,
  error: paths.x,
};

export function AutonomyPage({
  goals,
  runs,
  onCreateGoal,
  onToggleGoal,
  onRunNow,
}: {
  goals: AgentGoal[];
  runs: AgentRun[];
  onCreateGoal: (g: { warehouseId: string; threshold: number; autonomy: string; dailyBudgetQty: number }) => Promise<void>;
  onToggleGoal: (id: string, active: boolean) => Promise<void>;
  onRunNow: (warehouseId: string, goalId?: string) => Promise<void>;
}) {
  const [warehouseId, setWarehouseId] = useState('1030');
  const [threshold, setThreshold] = useState('50');
  const [autonomy, setAutonomy] = useState('propose');
  const [budget, setBudget] = useState('200');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="card p-5">
        <h3 className="text-sm font-semibold text-fp-ink">Standing goals</h3>
        <p className="mb-4 text-xs text-fp-ink-3">
          The agent checks every active goal each 15 minutes — and immediately when a stock alert fires. The toggle is
          your kill switch.
        </p>

        <div className="mb-4 rounded-2xl border border-fp-line p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fp-ink-3">New goal</div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-32 py-2 text-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {WAREHOUSES.map((w) => (
                <option key={w} value={w}>
                  WH {w}
                </option>
              ))}
            </select>
            <input
              className="input !w-24 py-2 text-xs"
              placeholder="Threshold"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <select className="input !w-56 py-2 text-xs" value={autonomy} onChange={(e) => setAutonomy(e.target.value)}>
              <option value="observe">Observe — report only (dry run)</option>
              <option value="propose">Propose — draft for approval</option>
              <option value="act">Act — auto-draft within budget</option>
            </select>
            <input
              className="input !w-28 py-2 text-xs"
              placeholder="Daily budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <button
              className="btn-primary px-3 py-2 text-xs"
              onClick={() =>
                void onCreateGoal({
                  warehouseId,
                  threshold: Number(threshold) || 50,
                  autonomy,
                  dailyBudgetQty: Number(budget) || 200,
                })
              }
            >
              <Icon path={paths.plus} size={12} strokeWidth={2.4} />
              Create goal
            </button>
          </div>
        </div>

        {goals.length === 0 ? (
          <EmptyState
            icon={paths.bolt}
            title="No standing goals yet"
            hint='Create one here, or ask Otto: "keep warehouse 1030 stocked above 50".'
          />
        ) : (
          <div className="space-y-2.5">
            {goals.map((g) => (
              <div key={g.id} className="rounded-2xl border border-fp-line p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-fp-ink">WH {g.warehouse_id}</span>
                    <span className="chip bg-fp-bg text-fp-ink-2">above {g.threshold}</span>
                    <span
                      className={`chip ${
                        g.autonomy === 'act'
                          ? 'bg-fp-good-soft text-fp-good'
                          : g.autonomy === 'propose'
                            ? 'bg-fp-accent-soft text-fp-accent-dark'
                            : 'bg-fp-bg text-fp-ink-2'
                      }`}
                    >
                      {g.autonomy}
                    </span>
                    <span className="chip bg-fp-bg text-fp-ink-2">budget {g.daily_budget_qty}/day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-[11px]"
                      onClick={() => void onRunNow(g.warehouse_id, g.id)}
                    >
                      Run now
                    </button>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-fp-ink-2">
                      <input type="checkbox" checked={g.active} onChange={(e) => void onToggleGoal(g.id, e.target.checked)} />
                      {g.active ? 'Active' : 'Paused'}
                    </label>
                  </div>
                </div>
                {g.last_run_at && (
                  <div className="mt-1.5 text-[11px] text-fp-ink-3">
                    Last run {new Date(g.last_run_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold text-fp-ink">Agent runs</h3>
        <p className="mb-4 text-xs text-fp-ink-3">
          Every run is a persisted plan → execute → verify episode. Click a run to see its full timeline.
        </p>

        {runs.length === 0 ? (
          <EmptyState icon={paths.history} title="No runs yet" hint="Create a goal and hit Run now." />
        ) : (
          <div className="space-y-2.5">
            {runs.map((run) => (
              <div key={run.id} className="overflow-hidden rounded-2xl border border-fp-line">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-fp-bg/60"
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-fp-ink">{run.goal_text}</div>
                    <div className="mt-0.5 text-[11px] text-fp-ink-3">
                      {new Date(run.started_at).toLocaleString()} · {run.steps.length} step
                      {run.steps.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className={`chip shrink-0 ${STATUS_STYLE[run.status] || 'bg-fp-bg text-fp-ink-2'}`}>
                    {run.status.replace('_', ' ')}
                  </span>
                </button>

                {expandedRun === run.id && (
                  <div className="border-t border-fp-line bg-fp-bg/40 px-4 py-3">
                    <ol className="space-y-2">
                      {run.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ${
                              step.status === 'failed'
                                ? 'bg-fp-bad-soft text-fp-bad'
                                : step.status === 'pending'
                                  ? 'bg-fp-warn-soft text-fp-warn'
                                  : 'bg-fp-accent-soft text-fp-accent-dark'
                            }`}
                          >
                            <Icon path={STEP_ICON[step.type] || paths.chat} size={12} strokeWidth={2.2} />
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] leading-relaxed text-fp-ink">{step.detail}</div>
                            <div className="text-[10px] uppercase tracking-wider text-fp-ink-3">
                              {step.type} · {new Date(step.at).toLocaleTimeString()}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {run.summary && (
                      <div className="mt-3 rounded-xl bg-fp-surface px-3 py-2 text-xs font-medium text-fp-ink">
                        {run.summary}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
