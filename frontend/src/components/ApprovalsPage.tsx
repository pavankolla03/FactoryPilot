import type { PendingAction } from '@manufacturing-agent/shared';
import { EmptyState, Icon, paths } from './ui';
import type { StockAlert } from './ChatPage';
import { useI18n } from '../i18n';

export type ScheduledReport = {
  id: string;
  report: string;
  warehouse_id: string | null;
  hour: number;
  day_of_week: number | null;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ApprovalsPage({
  pendingActions,
  alerts,
  schedules,
  onConfirm,
  onCancel,
  onDeleteAlert,
  onDeleteSchedule,
}: {
  pendingActions: PendingAction[];
  alerts: StockAlert[];
  schedules: ScheduledReport[];
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  onDeleteAlert: (id: string) => void;
  onDeleteSchedule: (id: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-fp-ink">{t('approvals.title')}</h3>
            <p className="text-xs text-fp-ink-3">
              Writes proposed by the agent or the operations board — nothing touches SAP until approved here.
            </p>
          </div>
          {pendingActions.length > 0 && (
            <span className="chip bg-fp-warn-soft text-fp-warn">
              {pendingActions.length} {t('approvals.awaiting')}
            </span>
          )}
        </div>

        {pendingActions.length === 0 ? (
          <EmptyState icon={paths.shield} title={t('approvals.empty.title')} hint={t('approvals.empty.hint')} />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {pendingActions.map((action) => (
              <ApprovalCard key={action.actionId} action={action} onConfirm={onConfirm} onCancel={onCancel} />
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-fp-ink">{t('alerts.title')}</h3>
            <p className="text-xs text-fp-ink-3">Checked against live stock every minute.</p>
          </div>
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

        <div className="mt-5 border-t border-fp-line pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-fp-ink">Scheduled reports</h3>
              <p className="text-xs text-fp-ink-3">Ask Otto: "send me the shift handover every Monday at 7".</p>
            </div>
            {schedules.length > 0 && (
              <span className="chip bg-fp-accent-soft text-fp-accent-dark">{schedules.length}</span>
            )}
          </div>

          {schedules.length === 0 ? (
            <p className="text-xs leading-relaxed text-fp-ink-3">No scheduled reports yet.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-fp-line px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-fp-ink">
                      {s.report === 'usage_summary' ? 'Usage summary' : 'Shift handover'}
                      {s.warehouse_id ? ` · WH ${s.warehouse_id}` : ''}
                    </div>
                    <div className="text-[11px] text-fp-ink-3">
                      {s.day_of_week === null ? 'Daily' : `Every ${DOW[s.day_of_week]}`} at{' '}
                      {String(s.hour).padStart(2, '0')}:00
                    </div>
                  </div>
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fp-ink-3 transition hover:bg-fp-bad-soft hover:text-fp-bad"
                    onClick={() => onDeleteSchedule(s.id)}
                  >
                    <Icon path={paths.x} size={12} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ApprovalCard({
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
      <div
        className={`border-l-[3px] px-4 py-3 ${
          action.anomaly ? 'border-fp-bad bg-fp-bad-soft/50' : 'border-fp-accent bg-fp-accent-soft/40'
        }`}
      >
        <div className="text-sm font-semibold text-fp-ink">
          {action.tool === 'batch' ? `${steps.length} ${t('approvals.steps')}` : prettyTool(action.tool)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fp-ink-3">
          <span>
            {t('approvals.requires')}
            {action.requestedBy ? ` · requested by ${action.requestedBy}` : ''}
          </span>
          {action.runId && <span className="chip bg-fp-accent-soft text-fp-accent-dark">agent run</span>}
        </div>
      </div>

      {action.anomaly && (
        <div className="flex items-start gap-2 border-b border-fp-line bg-fp-bad-soft/40 px-4 py-2.5">
          <Icon path={paths.shield} size={13} strokeWidth={2.2} />
          <span className="text-xs font-medium text-fp-bad">Unusual: {action.anomaly.reason}</span>
        </div>
      )}

      {action.makerChecker && (
        <div className="border-b border-fp-line bg-fp-warn-soft/50 px-4 py-2 text-[11px] font-medium text-fp-warn">
          Maker-checker policy: a different administrator must approve this.
        </div>
      )}

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

function prettyTool(tool: string) {
  const map: Record<string, string> = {
    moveStock: 'Move stock between locations',
    draftPurchaseRequisition: 'Draft purchase requisition',
  };
  return map[tool] || tool;
}

function prettyKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .replace('Id', 'ID');
}
