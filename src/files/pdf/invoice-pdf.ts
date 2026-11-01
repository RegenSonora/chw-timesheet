// The invoice PDF (SPEC §7): page 1 invoice, pages 2+ timesheet. The only file that is signed.
import { paginateTimesheet } from '../../core/timesheet';
import type { FundingSourceConfig, Invoice } from '../../core/types';
import { drawInvoicePage } from './invoice-page';
import { drawTimesheetPage } from './timesheet-page';
import { LETTER, LETTER_LANDSCAPE, PdfDocument } from './writer';

export function invoicePdf(
  invoice: Invoice,
  source: Pick<FundingSourceConfig, 'tasks' | 'budget_lines'>,
): Uint8Array<ArrayBuffer> {
  const pages = paginateTimesheet(invoice, source);
  const doc = new PdfDocument();
  drawInvoicePage(doc.addPage(LETTER), invoice, pages.length + 1);
  pages.forEach((page, i) => {
    drawTimesheetPage(doc.addPage(LETTER_LANDSCAPE), invoice, page, pages[i + 1]);
  });
  return doc.bytes({
    title: `Invoice ${invoice.number}`,
    author: invoice.chw.name,
    created: invoice.created_at,
  });
}
