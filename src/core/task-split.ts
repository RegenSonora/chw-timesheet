// Several tasks per entry (decision 0024): the billed quarter-hours split between checked tasks.
import type { TaskShare } from './types';

export type SplitStatus =
  | { state: 'ok'; total: number; assigned: number }
  /** `quarters` still to assign. */
  | { state: 'left'; total: number; assigned: number; quarters: number }
  /** `quarters` assigned beyond the total. */
  | { state: 'over'; total: number; assigned: number; quarters: number };

/** How the shares compare with the entry's billed quarter-hours, for the "left to assign" bar. */
export function splitStatus(totalQuarters: number, shares: readonly TaskShare[]): SplitStatus {
  const assigned = shares.reduce((sum, s) => sum + s.quarters, 0);
  if (assigned === totalQuarters) return { state: 'ok', total: totalQuarters, assigned };
  return assigned < totalQuarters
    ? { state: 'left', total: totalQuarters, assigned, quarters: totalQuarters - assigned }
    : { state: 'over', total: totalQuarters, assigned, quarters: assigned - totalQuarters };
}

/**
 * Check a task. The first one gets all the hours; later ones start at 0. Checking a second task
 * resets the first to all the hours, since its share may predate a change of times.
 */
export function checkTask(
  shares: readonly TaskShare[],
  taskId: string,
  totalQuarters: number,
): readonly TaskShare[] {
  if (shares.some((s) => s.task_id === taskId)) return shares;
  const [only] = shares;
  if (!only) return [{ task_id: taskId, quarters: totalQuarters }];
  const kept = shares.length === 1 ? [{ ...only, quarters: totalQuarters }] : shares;
  return [...kept, { task_id: taskId, quarters: 0 }];
}

export function uncheckTask(shares: readonly TaskShare[], taskId: string): TaskShare[] {
  return shares.filter((s) => s.task_id !== taskId);
}

/** The shares an entry is saved with: a lone task gets all the hours; tasks at 0 h are dropped. */
export function finalShares(shares: readonly TaskShare[], totalQuarters: number): TaskShare[] {
  const [only, ...more] = shares;
  if (only && more.length === 0) return [{ task_id: only.task_id, quarters: totalQuarters }];
  return shares.filter((s) => s.quarters !== 0).map((s) => ({ ...s }));
}

/** True when the shares can be saved or invoiced: known tasks, once each, whole positive quarters, adding up. */
export function sharesMatch(
  shares: readonly TaskShare[],
  totalQuarters: number,
  taskIds: ReadonlySet<string>,
): boolean {
  if (shares.length === 0) return false;
  const seen = new Set<string>();
  for (const s of shares) {
    if (!taskIds.has(s.task_id) || seen.has(s.task_id)) return false;
    if (!Number.isSafeInteger(s.quarters) || s.quarters < 1) return false;
    seen.add(s.task_id);
  }
  return splitStatus(totalQuarters, shares).state === 'ok';
}
