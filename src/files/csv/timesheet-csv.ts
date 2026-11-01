// Timesheet CSV (SPEC §7, decision 0001): for people, mirrors the PDF timesheet pages.
import { formatCentsPlain, formatQuarters } from '../../core/money';
import { paginateTimesheet } from '../../core/timesheet';
import type { FundingSourceConfig, Invoice } from '../../core/types';
import { csvFile } from './csv';

const hours = (q: number | null) => (q === null ? '' : formatQuarters(q));

export function timesheetCsv(
  invoice: Invoice,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): Uint8Array {
  const rows: string[][] = [
    ['Invoice #', invoice.number],
    ['Funding source', invoice.source.code],
    ['CHW', invoice.chw.name],
    ['Service period', invoice.period_start, invoice.period_end],
    ['Rate', formatCentsPlain(invoice.rate_cents)],
    ['Fingerprint', invoice.fingerprint],
  ];
  for (const page of paginateTimesheet(invoice, source)) {
    rows.push(
      [],
      [`Page ${String(page.page_number)} of ${String(page.page_count)}`],
      ['Task', 'Core competency', 'Budget line', ...page.dates, 'Total hours', 'Notes'],
    );
    for (const row of page.rows) {
      rows.push([
        row.task_name,
        row.core_competency ?? '',
        row.budget_line_name,
        ...row.cells.map(hours),
        hours(row.total),
        row.notes,
      ]);
    }
    rows.push(['Total hours', '', '', ...page.date_totals.map(hours), hours(page.page_total), '']);
  }
  return csvFile(rows);
}
