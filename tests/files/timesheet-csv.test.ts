import { describe, expect, it } from 'vitest';
import { paginateTimesheet } from '../../src/core/timesheet';
import { timesheetCsv } from '../../src/files/csv/timesheet-csv';
import { findTestRole, makeEntry, regen, tisupp } from '../core/fixtures/wireframe-sample';
import goldenTimesheet from './golden/wireframe-timesheet.csv?raw';
import { csvText, invoiceFrom, sampleInvoice } from './helpers';

describe('timesheet CSV (SPEC §7, decision 0001)', () => {
  it('matches the golden file for the wireframe sample', async () => {
    const invoice = await sampleInvoice();
    const text = csvText(timesheetCsv(invoice, tisupp));
    expect(text.replaceAll('\r\n', '\n')).toBe(
      goldenTimesheet.replace('<FINGERPRINT>', invoice.fingerprint),
    );
    expect(text).toContain('\r\n');
    expect(text.replaceAll('\r\n', '')).not.toContain('\n');
  });

  it('has the same pages, dates and rows as the PDF pages', async () => {
    const invoice = await sampleInvoice();
    const text = csvText(timesheetCsv(invoice, tisupp));
    for (const page of paginateTimesheet(invoice, tisupp)) {
      expect(text).toContain(`Page ${String(page.page_number)} of ${String(page.page_count)}`);
      expect(text).toContain(`Task,Core competency,Budget line,${page.dates.join(',')},Total`);
    }
  });

  it('has no dollar amounts besides the rate', async () => {
    const text = csvText(timesheetCsv(await sampleInvoice(), tisupp));
    expect(text).not.toContain('$');
    expect(text).not.toContain('185.00');
  });

  it('quotes and guards notes', async () => {
    const invoice = await invoiceFrom({
      entries: [
        makeEntry('2026-10-30', '09:00:00', '10:00:00', 'outreach', 'outreach-and-marketing', {
          notes: '=1+1, "quoted"',
        }),
      ],
    });
    const text = csvText(timesheetCsv(invoice, tisupp));
    expect(text).toContain(`,1.00,1.00,"'=1+1, ""quoted"""\r\n`);
  });
});

describe('timesheet CSV by role (decisions 0031, 0032, 0034)', () => {
  it('says Timesheet #, Employee and Pay rate for an employee', async () => {
    const invoice = await invoiceFrom({ role: findTestRole('chw-te01') });
    const text = csvText(timesheetCsv(invoice, tisupp));
    expect(text).toContain(`Timesheet #,${invoice.number}\r\n`);
    expect(text).toContain('Employee,Carmen Cruz\r\n');
    expect(text).toContain('Pay rate,20.00\r\n');
    expect(text).toContain('Task,Core competency,Budget line,');
    expect(text).not.toContain('Invoice #');
  });

  it('leaves out the core competency column for a non-CHW role', async () => {
    const invoice = await invoiceFrom({
      source: regen,
      role: findTestRole('r-tl01'),
      settings: { source_id: regen.id, rate_cents: 2200, nte_cents: null },
      entries: [
        makeEntry('2026-10-01', '09:00:00', '10:00:00', 'dump-runs', 'fire-risk-reduction-work', {
          source_id: regen.id,
        }),
      ],
      prior_invoices: [],
    });
    const text = csvText(timesheetCsv(invoice, regen));
    expect(text).toContain('Contractor,Carmen Cruz\r\n');
    expect(text).toContain('Task,Budget line,2026-10-01,Total hours,Notes\r\n');
    expect(text).toContain('Dump runs,Fire risk reduction work,1.00,1.00,\r\n');
    expect(text).toContain('Total hours,,1.00,1.00,\r\n');
    expect(text).not.toContain('Core competency');
  });
});
