// The three invoice files (SPEC §7). Pure: an invoice in, bytes out. Re-creating a past
// invoice's files from stored data gives the same bytes (SPEC §6).
import type { FundingSourceConfig, Invoice } from '../core/types';
import { entriesCsv } from './csv/entries-csv';
import { timesheetCsv } from './csv/timesheet-csv';
import { entriesCsvName, pdfName, timesheetCsvName } from './names';
import { invoicePdf } from './pdf/invoice-pdf';

export interface InvoiceFile {
  name: string;
  type: 'application/pdf' | 'text/csv';
  bytes: Uint8Array<ArrayBuffer>;
}

/**
 * PDF, timesheet CSV, entry log CSV, in that order. `source` is the current funding source
 * file, used only to order timesheet rows; ids it no longer lists sort by name.
 */
export function buildInvoiceFiles(
  invoice: Invoice,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): InvoiceFile[] {
  return [
    { name: pdfName(invoice), type: 'application/pdf', bytes: invoicePdf(invoice, source) },
    { name: timesheetCsvName(invoice), type: 'text/csv', bytes: timesheetCsv(invoice, source) },
    { name: entriesCsvName(invoice), type: 'text/csv', bytes: entriesCsv(invoice) },
  ];
}

export { pdfName, timesheetCsvName, entriesCsvName } from './names';
