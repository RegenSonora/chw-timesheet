// Turning a half-entered record into an entry (SPEC §5). Uses the rules in src/core; no storage.
import {
  checkEntryTimes,
  checkRolePicks,
  duplicateCountLabel,
  emptyCounts,
  entryCountChoices,
  entryDateOf,
  finalShares,
  findOverlaps,
  resolveHandTimes,
  roleTaskIds,
  sharesMatch,
  type CountDef,
  type Counts,
  type Entry,
  type FundingSourceConfig,
  type Role,
} from '../core';
import type { EntryDraft } from '../storage';
import { localDateTime } from './format';

/** Offset east of UTC in minutes at an instant, in the phone's time zone. */
export const phoneOffsetAt = (epochMs: number): number => -new Date(epochMs).getTimezoneOffset();

export function newTimerDraft(
  sourceId: string,
  start: string,
  stop: string,
  budgetLineId: string | null,
): EntryDraft {
  return {
    kind: 'entry',
    entry_id: null,
    step: 'task',
    hand: null,
    start,
    stop,
    source_id: sourceId,
    tasks: [],
    budget_line_id: budgetLineId,
    counts: emptyCounts(),
    notes: '',
  };
}

export function newHandDraft(
  sourceId: string,
  hand: { date: string; start: string; end: string },
  budgetLineId: string | null,
): EntryDraft {
  return withHand({ ...newTimerDraft(sourceId, '', '', budgetLineId), step: 'times' }, hand);
}

/** Editing keeps the raw times until the CHW changes a time field. */
export function editDraft(entry: Entry): EntryDraft {
  const start = localDateTime(entry.start);
  const stop = localDateTime(entry.stop);
  return {
    kind: 'entry',
    entry_id: entry.id,
    step: 'edit',
    hand: { date: start.date, start: start.time, end: stop.time },
    start: entry.start,
    stop: entry.stop,
    source_id: entry.source_id,
    tasks: entry.tasks.map((s) => ({ ...s })),
    budget_line_id: entry.budget_line_id,
    counts: structuredClone(entry.counts),
    notes: entry.notes,
  };
}

/** New hand-entered fields; raw times follow when they make a valid date and times. */
export function withHand(
  draft: EntryDraft,
  hand: { date: string; start: string; end: string },
): EntryDraft {
  try {
    const times = resolveHandTimes(hand.date, hand.start, hand.end, phoneOffsetAt);
    return { ...draft, hand, start: times.start, stop: times.stop };
  } catch {
    return { ...draft, hand, start: null, stop: null };
  }
}

export type TimesCheck =
  | { state: 'incomplete' }
  | { state: 'too_short' }
  | { state: 'overlap'; other: Entry }
  | { state: 'ok'; seconds: number; quarters: number; next_day: boolean };

/** Can the draft's times be saved? Overlap is checked on raw times across all sources. */
export function checkDraftTimes(draft: EntryDraft, entries: readonly Entry[]): TimesCheck {
  if (!draft.start || !draft.stop) return { state: 'incomplete' };
  const times = checkEntryTimes(draft.start, draft.stop);
  if (!times.ok) return { state: times.reason === 'too_short' ? 'too_short' : 'incomplete' };
  const other = findOverlaps(
    { start: draft.start, stop: draft.stop },
    entries,
    draft.entry_id ?? undefined,
  )[0];
  if (other) return { state: 'overlap', other };
  const nextDay = entryDateOf(draft.start) !== entryDateOf(draft.stop);
  return { state: 'ok', seconds: times.seconds, quarters: times.quarters, next_day: nextDay };
}

export type DraftProblem =
  | 'times'
  | 'task'
  /** Two or more tasks whose hours don't add up to the entry's (decision 0024). */
  | 'split'
  | 'budget_line'
  /** The source doesn't take time on the entry's date for this role (decision 0033). */
  | 'source_period'
  /** A custom count has a number but no name. */
  | 'count_label'
  /** A custom count repeats one of the entry's counts (decision 0029). */
  | 'count_duplicate';

/** Custom counts with no name and no number are dropped; names are trimmed. */
export function cleanCounts(counts: Counts): Counts | null {
  const other = [];
  for (const o of counts.other) {
    const label = o.label.trim();
    if (!label && o.value === 0) continue;
    if (!label) return null;
    other.push({ label, value: o.value });
  }
  return { ...counts, other };
}

export function buildEntry(
  draft: EntryDraft,
  source: FundingSourceConfig,
  entries: readonly Entry[],
  existing: Entry | null,
  now: string,
  newId: () => string,
  /**
   * The person's role: choices come from it (decision 0028). Null on a phone set up before roles,
   * which keeps the source's own choices. An edited entry keeps the role it was saved under.
   */
  role: Role | null,
  countDefs: readonly CountDef[],
): { ok: true; entry: Entry } | { ok: false; problem: DraftProblem } {
  const times = checkDraftTimes(draft, entries);
  if (times.state !== 'ok' || !draft.start || !draft.stop) return { ok: false, problem: 'times' };
  const lineId = draft.budget_line_id;
  const known = new Set(
    role ? (lineId ? roleTaskIds(role, source.id, lineId) : []) : source.tasks.map((t) => t.id),
  );
  const tasks = finalShares(
    draft.tasks.filter((s) => known.has(s.task_id)),
    times.quarters,
  );
  const taskIds = tasks.map((s) => s.task_id);
  if (role) {
    const problem = checkRolePicks(role, source, entryDateOf(draft.start), lineId, taskIds);
    if (problem) return { ok: false, problem };
  }
  if (tasks.length === 0) return { ok: false, problem: 'task' };
  if (!sharesMatch(tasks, times.quarters, known)) return { ok: false, problem: 'split' };
  if (!draft.budget_line_id || !source.budget_lines.some((l) => l.id === draft.budget_line_id)) {
    return { ok: false, problem: 'budget_line' };
  }
  const counts = cleanCounts(draft.counts);
  if (!counts) return { ok: false, problem: 'count_label' };
  if (role) {
    const shown = entryCountChoices(countDefs, role, source, lineId, taskIds, counts);
    if (counts.other.some((o) => duplicateCountLabel(o.label, shown))) {
      return { ok: false, problem: 'count_duplicate' };
    }
  }
  return {
    ok: true,
    entry: {
      id: existing?.id ?? newId(),
      source_id: source.id,
      role_id: existing ? existing.role_id : (role?.id ?? null),
      start: draft.start,
      stop: draft.stop,
      entry_date: entryDateOf(draft.start),
      tasks,
      budget_line_id: draft.budget_line_id,
      counts,
      notes: draft.notes.trim(),
      invoice_id: null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
  };
}
