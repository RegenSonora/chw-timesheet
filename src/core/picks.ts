// Task and budget line choices on the new-entry screen (SPEC §5, decision 0008).
import type { FundingSourceConfig, Task } from './types';

/** How many recent tasks the "Recent" group shows. */
export const RECENT_TASKS_SHOWN = 3;

/** "Recent" (most recent first, only tasks this source has) above every task in source order. */
export function taskChoices(
  source: FundingSourceConfig,
  recentIds: readonly string[],
): { recent: Task[]; all: Task[] } {
  const byId = new Map(source.tasks.map((t) => [t.id, t]));
  const recent: Task[] = [];
  for (const id of new Set(recentIds)) {
    const task = byId.get(id);
    if (task) recent.push(task);
    if (recent.length === RECENT_TASKS_SHOWN) break;
  }
  return { recent, all: source.tasks };
}

/** The budget line a new entry starts with: the last one used, if this source has it. */
export function defaultBudgetLine(
  source: FundingSourceConfig,
  lastId: string | null,
): string | null {
  return lastId !== null && source.budget_lines.some((l) => l.id === lastId) ? lastId : null;
}

/** Moving an entry to another source keeps the picks that source also has (decision 0008). */
export function carryPicks(
  source: FundingSourceConfig,
  taskId: string | null,
  budgetLineId: string | null,
): { task_id: string | null; budget_line_id: string | null } {
  return {
    task_id: taskId !== null && source.tasks.some((t) => t.id === taskId) ? taskId : null,
    budget_line_id: defaultBudgetLine(source, budgetLineId),
  };
}
