// The three invoice files (SPEC §7). Pure: an invoice in, bytes out. Re-creating a past
// invoice's files from stored data gives the same bytes (SPEC §6).
import { paginateTimesheet } from '../core/timesheet';
import type { FundingSourceConfig, Invoice } from '../core/types';
import { entriesCsv } from './csv/entries-csv';
import { timesheetCsv } from './csv/timesheet-csv';
import { entriesCsvName, pdfName, timesheetCsvName } from './names';
import { drawInvoicePage } from './pdf/invoice-page';
import { invoicePdf } from './pdf/invoice-pdf';
import { LETTER, PdfPage, type Shape } from './pdf/writer';

export interface InvoiceFile {
  name: string;
  type: 'application/pdf' | 'text/csv' | 'image/png';
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

/**
 * PDF page 1 as shapes, for the picture the UI paints (decision 0018). Same layout and scale as
 * the PDF's page 1.
 */
export function invoicePageShapes(
  invoice: Invoice,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): { width: number; height: number; shapes: Shape[] } {
  const page = new PdfPage(LETTER.width, LETTER.height);
  drawInvoicePage(page, invoice, paginateTimesheet(invoice, source).length + 1);
  return { width: page.width, height: page.height, shapes: page.shapes };
}

export type { Shape } from './pdf/writer';
export { pdfName, pngName, timesheetCsvName, entriesCsvName } from './names';
export {
  buildWorkHoursFiles,
  datesText,
  reportBaseName,
  splitName,
  usDate,
  workHoursPageShapes,
  type ReportDetails,
} from './report/work-hours';
