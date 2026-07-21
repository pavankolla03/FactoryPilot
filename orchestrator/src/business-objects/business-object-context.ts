/**
 * Contextualization (spec Component 5): turn raw OData records for a business
 * object into status counts, dimension breakdowns, and date buckets, plus a
 * one-line summary. Config-driven — no per-object code.
 */

type Row = Record<string, unknown>;

export interface ContextConfig {
  objectName: string;
  statusField: string | null;
  statusLabels: Record<string, string> | null;
  groupBy: string[]; // dimension fields, e.g. ["Route","Carrier"]
  dateField: string | null;
}

export interface BusinessObjectSummary {
  total: number;
  byStatus: Array<{ value: string; label: string; count: number }>;
  groups: Record<string, Array<{ value: string; count: number }>>;
  dateBuckets: { overdue: number; today: number; upcoming: number } | null;
  summaryText: string;
}

function countBy(records: Row[], field: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of records) {
    const key = String(r[field] ?? '—');
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

export function contextualize(records: Row[], cfg: ContextConfig): BusinessObjectSummary {
  const total = records.length;

  const byStatus: BusinessObjectSummary['byStatus'] = [];
  if (cfg.statusField) {
    for (const [value, count] of countBy(records, cfg.statusField)) {
      byStatus.push({ value, label: cfg.statusLabels?.[value] ?? value, count });
    }
    byStatus.sort((a, b) => b.count - a.count);
  }

  const groups: BusinessObjectSummary['groups'] = {};
  for (const field of cfg.groupBy) {
    if (!field) {
      continue;
    }
    groups[field] = [...countBy(records, field)]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  let dateBuckets: BusinessObjectSummary['dateBuckets'] = null;
  if (cfg.dateField) {
    const today = new Date().toISOString().slice(0, 10);
    let overdue = 0;
    let todayCount = 0;
    let upcoming = 0;
    for (const r of records) {
      const d = String(r[cfg.dateField] ?? '').slice(0, 10);
      if (!d) {
        continue;
      }
      if (d < today) {
        overdue += 1;
      } else if (d === today) {
        todayCount += 1;
      } else {
        upcoming += 1;
      }
    }
    dateBuckets = { overdue, today: todayCount, upcoming };
  }

  // Compose a concise, business-meaningful summary line (spec's summaryText).
  const parts: string[] = [`${total} ${cfg.objectName.toLowerCase()}`];
  if (dateBuckets && (dateBuckets.overdue || dateBuckets.today)) {
    const bits: string[] = [];
    if (dateBuckets.overdue) bits.push(`${dateBuckets.overdue} overdue`);
    if (dateBuckets.today) bits.push(`${dateBuckets.today} due today`);
    if (dateBuckets.upcoming) bits.push(`${dateBuckets.upcoming} upcoming`);
    parts.push(bits.join(', '));
  } else if (byStatus.length) {
    parts.push(byStatus.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', '));
  }
  const summaryText = parts.join(' — ');

  return { total, byStatus, groups, dateBuckets, summaryText };
}
