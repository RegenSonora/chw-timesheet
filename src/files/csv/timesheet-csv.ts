// Timesheet CSV (SPEC §7, decision 0001): for people, mirrors the PDF timesheet pages. Wording
// follows the role (decision 0034); the core competency column is for CHW roles (decision 0032).
import { formatCentsPlain, formatQuarters } from '../../core/money';
import { paginateTimesheet } from '../../core/timesheet';
import type { FundingSourceConfig, Invoice } from '../../core/types';
import { csvFile } from './csv';

const hours = (q: number | null) => (q === null ? '' : formatQuarters(q));

export function timesheetCsv(
  invoice: Invoice,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): Uint8Array<ArrayBuffer> {
  const employee = invoice.kind === 'timesheet';
  const chw = invoice.role?.chw !== false;
  /** The core competency cell, left out for non-CHW roles. */
  const competency = (s: string) => (chw ? [s] : []);
  const rows: string[][] = [
    [employee ? 'Timesheet #' : 'Invoice #', invoice.number],
    ['Funding source', invoice.source.code],
    [employee ? 'Employee' : 'Contractor', invoice.chw.name],
    ['Service period', invoice.period_start, invoice.period_end],
    [employee ? 'Pay rate' : 'Rate', formatCentsPlain(invoice.rate_cents)],
    ['Fingerprint', invoice.fingerprint],
  ];
  for (const page of paginateTimesheet(invoice, source)) {
    rows.push(
      [],
      [`Page ${String(page.page_number)} of ${String(page.page_count)}`],
      [
        'Task',
        ...competency('Core competency'),
        'Budget line',
        ...page.dates,
        'Total hours',
        'Notes',
      ],
    );
    for (const row of page.rows) {
      rows.push([
        row.task_name,
        ...competency(row.core_competency ?? ''),
        row.budget_line_name,
        ...row.cells.map(hours),
        hours(row.total),
        row.notes,
      ]);
    }
    rows.push([
      'Total hours',
      ...competency(''),
      '',
      ...page.date_totals.map(hours),
      hours(page.page_total),
      '',
    ]);
  }
  return csvFile(rows);
}
