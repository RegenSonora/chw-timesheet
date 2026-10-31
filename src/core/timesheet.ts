// Timesheet pages (SPEC §7): the next 7 unique dates with entries per page.
import type { FundingSourceConfig, Invoice } from './types';

export const DATES_PER_PAGE = 7;

export interface TimesheetRow {
  task_id: string;
  task_name: string;
  core_competency: string | null;
  budget_line_id: string;
  budget_line_name: string;
  /** Quarter-hours per date column; null where the row has no entry. */
  cells: (number | null)[];
  total: number;
  /** Joined per decision 0003. */
  notes: string;
}

export interface TimesheetPage {
  /** PDF page number; page 1 is the invoice. */
  page_number: number;
  /** Pages in the whole PDF. */
  page_count: number;
  /** "Dates worked A–B of C". */
  first_date_index: number;
  last_date_index: number;
  date_count: number;
  dates: string[];
  rows: TimesheetRow[];
  /** Quarter-hours per date column. */
  date_totals: number[];
  /** In the source's budget line order (decision 0002). */
  subtotals: { budget_line_id: string; budget_line_name: string; quarters: number }[];
  page_total: number;
}

function joinNotes(notes: readonly string[]): string {
  const kept: string[] = [];
  for (const note of notes) {
    const trimmed = note.trim();
    if (trimmed && !kept.includes(trimmed)) kept.push(trimmed);
  }
  return kept.join('; ');
}

/**
 * Split an invoice's entries into timesheet pages. Rows are task + budget line pairs used
 * on the page, in the source's task order, then budget line order. Ids a later source
 * release no longer lists sort after known ones, by name.
 */
export function paginateTimesheet(
  invoice: Pick<Invoice, 'entries'>,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): TimesheetPage[] {
  const taskOrder = new Map(source.tasks.map((t, i) => [t.id, i]));
  const lineOrder = new Map(source.budget_lines.map((l, i) => [l.id, i]));
  const rank = (order: Map<string, number>, id: string) => order.get(id) ?? Number.MAX_SAFE_INTEGER;
  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

  // invoice.entries are already sorted by start, so notes join oldest first.
  const allDates = [...new Set(invoice.entries.map((e) => e.entry_date))].sort();
  const pageCount = Math.ceil(allDates.length / DATES_PER_PAGE);

  return Array.from({ length: pageCount }, (_, p) => {
    const dates = allDates.slice(p * DATES_PER_PAGE, (p + 1) * DATES_PER_PAGE);
    const column = new Map(dates.map((d, i) => [d, i]));
    const onPage = invoice.entries.filter((e) => column.has(e.entry_date));

    const rows = new Map<string, TimesheetRow & { notesList: string[] }>();
    for (const e of onPage) {
      const key = `${e.task_id}\u0000${e.budget_line_id}`;
      let row = rows.get(key);
      if (!row) {
        row = {
          task_id: e.task_id,
          task_name: e.task_name,
          core_competency: e.core_competency,
          budget_line_id: e.budget_line_id,
          budget_line_name: e.budget_line_name,
          cells: dates.map(() => null),
          total: 0,
          notes: '',
          notesList: [],
        };
        rows.set(key, row);
      }
      const i = column.get(e.entry_date) ?? 0;
      row.cells[i] = (row.cells[i] ?? 0) + e.quarters;
      row.total += e.quarters;
      row.notesList.push(e.notes);
    }

    const sortedRows = [...rows.values()]
      .sort(
        (a, b) =>
          rank(taskOrder, a.task_id) - rank(taskOrder, b.task_id) ||
          byText(a.task_name, b.task_name) ||
          rank(lineOrder, a.budget_line_id) - rank(lineOrder, b.budget_line_id) ||
          byText(a.budget_line_name, b.budget_line_name),
      )
      .map(({ notesList, ...row }) => ({ ...row, notes: joinNotes(notesList) }));

    const subtotals = new Map<string, TimesheetPage['subtotals'][number]>();
    for (const row of [...sortedRows].sort(
      (a, b) =>
        rank(lineOrder, a.budget_line_id) - rank(lineOrder, b.budget_line_id) ||
        byText(a.budget_line_name, b.budget_line_name),
    )) {
      const sub = subtotals.get(row.budget_line_id);
      if (sub) sub.quarters += row.total;
      else
        subtotals.set(row.budget_line_id, {
          budget_line_id: row.budget_line_id,
          budget_line_name: row.budget_line_name,
          quarters: row.total,
        });
    }

    const dateTotals = dates.map((_, i) =>
      sortedRows.reduce((sum, row) => sum + (row.cells[i] ?? 0), 0),
    );
    return {
      page_number: p + 2,
      page_count: pageCount + 1,
      first_date_index: p * DATES_PER_PAGE + 1,
      last_date_index: p * DATES_PER_PAGE + dates.length,
      date_count: allDates.length,
      dates,
      rows: sortedRows,
      date_totals: dateTotals,
      subtotals: [...subtotals.values()],
      page_total: dateTotals.reduce((sum, q) => sum + q, 0),
    };
  });
}
