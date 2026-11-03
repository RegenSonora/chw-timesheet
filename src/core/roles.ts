// Role choices on setup and the new-entry screen, rate prefill and counts per task
// (decisions 0027, 0028, 0029, 0030, 0033).
import { RECENT_TASKS_SHOWN } from './picks';
import type {
  BudgetLine,
  CountDef,
  Counts,
  FundingSourceConfig,
  OtherCount,
  Role,
  RoleFunding,
  Task,
} from './types';

/** The roles setup offers: active ones, in file order. */
export function roleChoices(roles: readonly Role[]): Role[] {
  return roles.filter((r) => !r.retired);
}

/**
 * The role a stored role id means now, following `replaced_by` (decision 0027). A retired role
 * with no replacement is returned as it is; undefined for an unknown id or a broken chain.
 */
export function resolveRole(roles: readonly Role[], id: string): Role | undefined {
  const seen = new Set<string>();
  let role = roles.find((r) => r.id === id);
  while (role?.replaced_by !== undefined) {
    if (seen.has(role.id)) return undefined;
    seen.add(role.id);
    const next: string = role.replaced_by;
    role = roles.find((r) => r.id === next);
  }
  return role;
}

export interface FundingChoice {
  funding: RoleFunding;
  source: FundingSourceConfig;
}

/**
 * The role's sources that take time dated `date` (YYYY-MM-DD), in the role's order: inside the
 * source's period and not after the funding entry's own end (decision 0033).
 */
export function fundingChoices(
  role: Role,
  sources: readonly FundingSourceConfig[],
  date: string,
): FundingChoice[] {
  const choices: FundingChoice[] = [];
  for (const funding of role.funding) {
    const source = sources.find((s) => s.id === funding.source_id);
    if (!source) continue;
    if (source.period_start !== null && date < source.period_start) continue;
    if (source.period_end !== null && date > source.period_end) continue;
    if (funding.ends !== undefined && date > funding.ends) continue;
    choices.push({ funding, source });
  }
  return choices;
}

function roleLine(role: Role, sourceId: string, lineId: string) {
  return role.funding
    .find((f) => f.source_id === sourceId)
    ?.budget_lines.find((l) => l.id === lineId);
}

/** The source's budget lines this role bills, in the role's order (decision 0028). */
export function budgetLineChoices(role: Role, source: FundingSourceConfig): BudgetLine[] {
  const lines = role.funding.find((f) => f.source_id === source.id)?.budget_lines ?? [];
  return lines.flatMap((l) => source.budget_lines.filter((b) => b.id === l.id));
}

/** The line a new entry starts on: the role's only line, else the last one used if still billed. */
export function roleDefaultLine(
  role: Role,
  source: FundingSourceConfig,
  lastId: string | null,
): string | null {
  const lines = budgetLineChoices(role, source);
  const [only, ...more] = lines;
  if (only && more.length === 0) return only.id;
  return lastId !== null && lines.some((l) => l.id === lastId) ? lastId : null;
}

/** The task ids the role lists under a line, in role order. */
export function roleTaskIds(role: Role, sourceId: string, lineId: string): string[] {
  return roleLine(role, sourceId, lineId)?.tasks.map((t) => t.id) ?? [];
}

/** "Recent" (most recent first, only this line's tasks) above the line's tasks in role order. */
export function taskChoices(
  role: Role,
  source: FundingSourceConfig,
  lineId: string,
  recentIds: readonly string[],
): { recent: Task[]; all: Task[] } {
  const ids = roleLine(role, source.id, lineId)?.tasks.map((t) => t.id) ?? [];
  const all = ids.flatMap((id) => source.tasks.filter((t) => t.id === id));
  const recent: Task[] = [];
  for (const id of new Set(recentIds)) {
    const task = all.find((t) => t.id === id);
    if (task) recent.push(task);
    if (recent.length === RECENT_TASKS_SHOWN) break;
  }
  return { recent, all };
}

/** The counts the checked tasks show, joined, in the shared list's order (decision 0029). */
export function countChoices(
  countDefs: readonly CountDef[],
  role: Role,
  source: FundingSourceConfig,
  lineId: string,
  taskIds: readonly string[],
): CountDef[] {
  const tasks = roleLine(role, source.id, lineId)?.tasks ?? [];
  const ids = new Set(tasks.filter((t) => taskIds.includes(t.id)).flatMap((t) => t.count_ids));
  return countDefs.filter((c) => ids.has(c.id));
}

/**
 * The counts an entry shows: the checked tasks' counts plus any count that already holds a value,
 * so nothing entered is hidden, in the shared list's order (decision 0029).
 */
export function entryCountChoices(
  countDefs: readonly CountDef[],
  role: Role,
  source: FundingSourceConfig,
  lineId: string | null,
  taskIds: readonly string[],
  counts: Counts,
): CountDef[] {
  const shown = new Set(
    lineId === null ? [] : countChoices(countDefs, role, source, lineId, taskIds).map((c) => c.id),
  );
  return countDefs.filter((c) => shown.has(c.id) || (counts.values[c.id] ?? 0) !== 0);
}

export type RolePickProblem = 'source_period' | 'budget_line' | 'task';

/**
 * Does an entry fit the role: its source takes time on that date, the role bills its line, and
 * every task is on that line (decisions 0028, 0033). Null when it does.
 */
export function checkRolePicks(
  role: Role,
  source: FundingSourceConfig,
  date: string,
  lineId: string | null,
  taskIds: readonly string[],
): RolePickProblem | null {
  if (fundingChoices(role, [source], date).length === 0) return 'source_period';
  if (lineId === null || !budgetLineChoices(role, source).some((l) => l.id === lineId)) {
    return 'budget_line';
  }
  const onLine = new Set(roleTaskIds(role, source.id, lineId));
  if (taskIds.length === 0 || taskIds.some((id) => !onLine.has(id))) return 'task';
  return null;
}

/** Rate filled in at setup: funding entry, then role, then source (decision 0030). */
export function prefillRate(
  role: Role,
  funding: RoleFunding,
  source: FundingSourceConfig,
): number | null {
  return funding.rate_cents ?? role.suggested_rate_cents ?? source.default_rate_cents ?? null;
}

const labelKey = (label: string) => label.replace(/\s+/g, '').toLowerCase();

/**
 * The entry's count a typed "Add another count" label repeats, ignoring letter case and spaces,
 * or null (decision 0029).
 */
export function duplicateCountLabel(label: string, counts: readonly CountDef[]): CountDef | null {
  const key = labelKey(label);
  if (key === '') return null;
  return counts.find((c) => labelKey(c.label) === key) ?? null;
}

export interface InvoiceCount {
  /** Null for an "Add another count" label. */
  id: string | null;
  label: string;
  unit: string | null;
  period: number;
  all_time: number;
}

/** Merge other counts by trimmed label in any letter case, as sumCounts does. */
function otherByLabel(other: readonly OtherCount[]): Map<string, OtherCount> {
  const merged = new Map<string, OtherCount>();
  for (const { label, value } of other) {
    const trimmed = label.trim();
    const key = trimmed.toLowerCase();
    const seen = merged.get(key);
    if (seen) seen.value += value;
    else merged.set(key, { label: trimmed, value });
  }
  return merged;
}

/**
 * The counts an invoice or timesheet page lists: only those with a value in the period, each
 * with its all-time total, in the shared list's order, then other counts (decision 0029).
 */
export function invoiceCounts(
  countDefs: readonly CountDef[],
  period: Counts,
  allTime: Counts,
): InvoiceCount[] {
  const listed: InvoiceCount[] = countDefs
    .filter((c) => (period.values[c.id] ?? 0) !== 0)
    .map((c) => ({
      id: c.id,
      label: c.label,
      unit: c.unit ?? null,
      period: period.values[c.id] ?? 0,
      all_time: allTime.values[c.id] ?? 0,
    }));
  const allOther = otherByLabel(allTime.other);
  for (const [key, { label, value }] of otherByLabel(period.other)) {
    if (value === 0) continue;
    listed.push({
      id: null,
      label,
      unit: null,
      period: value,
      all_time: allOther.get(key)?.value ?? 0,
    });
  }
  return listed;
}
