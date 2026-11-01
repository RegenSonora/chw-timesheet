// File names (SPEC §7, decision 0006): the source's short code and the invoice number.
import type { Invoice } from '../core/types';

type Named = Pick<Invoice, 'number' | 'period_start' | 'period_end'> & {
  source: Pick<Invoice['source'], 'code'>;
};

const base = (invoice: Named) => `${invoice.source.code}_${invoice.number}`;

export const pdfName = (invoice: Named) =>
  `${base(invoice)}_${invoice.period_start}_to_${invoice.period_end}.pdf`;
export const timesheetCsvName = (invoice: Named) => `${base(invoice)}_timesheet.csv`;
export const entriesCsvName = (invoice: Named) => `${base(invoice)}_entries.csv`;
