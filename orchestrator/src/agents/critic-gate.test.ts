import { describe, expect, it } from 'vitest';

/**
 * The auto-execution gate, extracted so the decision itself is testable without
 * standing up the whole agent.
 *
 * This existed as `!critic.flagged`, and a critic that threw returned
 * flagged:false — so "the review could not run" and "the review passed" were
 * the same value, and an autonomy:'act' agent wrote to SAP unreviewed whenever
 * the model was rate-limited. On a free-tier key that is most days.
 */
function mayAutoExecute(args: {
  autonomy: string;
  totalQty: number;
  budget: number;
  critic: { flagged: boolean; available: boolean };
  withinWindow: boolean;
}): boolean {
  return (
    args.autonomy === 'act' &&
    args.totalQty <= args.budget &&
    args.critic.available &&
    !args.critic.flagged &&
    args.withinWindow
  );
}

const base = {
  autonomy: 'act',
  totalQty: 10,
  budget: 100,
  critic: { flagged: false, available: true },
  withinWindow: true,
};

describe('agent auto-execution gate', () => {
  it('executes when a review actually ran and passed', () => {
    expect(mayAutoExecute(base)).toBe(true);
  });

  it('does NOT execute when the critic could not run', () => {
    // The regression this guards: rate-limited critic must not read as approval.
    expect(mayAutoExecute({ ...base, critic: { flagged: false, available: false } })).toBe(false);
  });

  it('does not execute when the critic flagged the plan', () => {
    expect(mayAutoExecute({ ...base, critic: { flagged: true, available: true } })).toBe(false);
  });

  it('does not execute over the blast-radius budget', () => {
    expect(mayAutoExecute({ ...base, totalQty: 500 })).toBe(false);
  });

  it('does not execute outside the change window', () => {
    expect(mayAutoExecute({ ...base, withinWindow: false })).toBe(false);
  });

  it('never executes below act autonomy', () => {
    expect(mayAutoExecute({ ...base, autonomy: 'propose' })).toBe(false);
    expect(mayAutoExecute({ ...base, autonomy: 'observe' })).toBe(false);
  });
});
