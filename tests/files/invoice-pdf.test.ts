import { describe, expect, it } from 'vitest';
import { shortFingerprint } from '../../src/core/fingerprint';
import { paginateTimesheet } from '../../src/core/timesheet';
import type { Entry } from '../../src/core/types';
import { buildInvoiceFiles } from '../../src/files';
import { timesheetCsv } from '../../src/files/csv/timesheet-csv';
import { drawInvoicePage } from '../../src/files/pdf/invoice-page';
import { drawTimesheetPage } from '../../src/files/pdf/timesheet-page';
import { LETTER, LETTER_LANDSCAPE, PdfPage } from '../../src/files/pdf/writer';
import { counts, makeEntry, regen, tisupp } from '../core/fixtures/wireframe-sample';
import { csvText, invoiceFrom, sampleInvoice } from './helpers';
import { readPdf } from './pdf-reader';

const pdfOf = async (invoice: Awaited<ReturnType<typeof sampleInvoice>>, source = tisupp) => {
  const [pdf] = buildInvoiceFiles(invoice, source);
  if (!pdf) throw new Error('no PDF');
  return readPdf(pdf.bytes);
};

describe('invoice PDF for the wireframe sample (SPEC §7)', () => {
  it('has page 1 portrait and two landscape timesheet pages', async () => {
    const pages = await pdfOf(await sampleInvoice());
    expect(pages.map((p) => [p.width, p.height])).toEqual([
      [612, 792],
      [792, 612],
      [792, 612],
    ]);
  });

  it('puts everything SPEC §7 lists on page 1, as selectable text', async () => {
    const invoice = await sampleInvoice();
    const [page1] = await pdfOf(invoice);
    const text = page1?.text ?? '';
    for (const expected of [
      'INVOICE',
      'TISUPP · Trauma-Informed Substance Use Prevention Program',
      'Invoice # CC-2026-004',
      'Invoice date Oct 31, 2026',
      'Service period Oct 20 – Oct 30, 2026',
      'FROM (CONTRACTOR)',
      'Carmen Cruz',
      'Regenerating Sonora, Inc. PO Box 154 Superior, AZ 85173',
      'New CHWs: training, stipends, field hours 3.00 $20.00 $60.00',
      'CHW referrals 3.25 $20.00 $65.00',
      'Outreach and marketing 3.00 $20.00 $60.00',
      'Amount due 9.25 $185.00',
      'Contacts 6 48',
      'Applications completed 2 14',
      'Not-to-exceed amount $5,000.00',
      'Billed before this invoice $4,880.00',
      'Remaining -$65.00',
      'OVER CONTRACT LIMIT: do not pay without an amendment',
      `Certification: ${tisupp.certification_text}`,
      'CONTRACTOR (CHW)',
      'SERVICES RECEIVED (REVIEWER)',
      'Printed name',
      'Reviewed by',
      'Approved by',
      'Payment date',
      'Check or transaction #',
      `Fingerprint ${shortFingerprint(invoice.fingerprint)}`,
      'CC-2026-004 · Page 1 of 3',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('draws the timesheet pages as SPEC §7 describes', async () => {
    const invoice = await sampleInvoice();
    const [, page2, page3] = await pdfOf(invoice);
    for (const expected of [
      'Timesheet · TISUPP',
      'Dates worked 1–7 of 8 · Oct 20 – Oct 29, 2026',
      'Invoice CC-2026-004 · Rate $20.00/h',
      'TUE 10/20',
      'Outreach Outreach Outreach and marketing 0.50 1.00 1.50 3.00 Library table',
      'Total hours 0.50 0.50 0.50 1.00 2.00 1.50 1.75 7.75',
      'Page total 7.75 h',
      'Continued on page 3: Fri 10/30.',
      'CHW initials',
      `Fingerprint ${shortFingerprint(invoice.fingerprint)}`,
      'CC-2026-004 · Page 2 of 3',
    ]) {
      expect(page2?.text).toContain(expected);
    }
    expect(page3?.text).toContain('Dates worked 8 of 8 · Oct 30, 2026');
    expect(page3?.text).toContain('CC-2026-004 · Page 3 of 3');
    expect(page3?.text).not.toContain('Continued');
  });

  it('gives the same bytes every time, so a re-shared file matches', async () => {
    const invoice = await sampleInvoice();
    expect(buildInvoiceFiles(invoice, tisupp)).toEqual(buildInvoiceFiles(invoice, tisupp));
  });

  it('names and types the three files', async () => {
    const files = buildInvoiceFiles(await sampleInvoice(), tisupp);
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ['TISUPP_CC-2026-004_2026-10-20_to_2026-10-30.pdf', 'application/pdf'],
      ['TISUPP_CC-2026-004_timesheet.csv', 'text/csv'],
      ['TISUPP_CC-2026-004_entries.csv', 'text/csv'],
    ]);
  });
});

describe('contract tracking box (SPEC §6)', () => {
  it('says the NTE was not entered', async () => {
    const invoice = await invoiceFrom({
      settings: { source_id: 'tisupp', rate_cents: 2000, nte_cents: null },
    });
    const text = (await pdfOf(invoice))[0]?.text ?? '';
    expect(text).toContain('CONTRACT TRACKING');
    expect(text).toContain('Not-to-exceed amount not entered');
    expect(text).not.toContain('OVER CONTRACT LIMIT');
  });

  it('shows no warning under the limit', async () => {
    const invoice = await invoiceFrom({
      settings: { source_id: 'tisupp', rate_cents: 2000, nte_cents: 1_000_000 },
    });
    const text = (await pdfOf(invoice))[0]?.text ?? '';
    expect(text).toContain('Remaining $4,935.00');
    expect(text).not.toContain('OVER CONTRACT LIMIT');
  });

  it('is left out for a source without an NTE', async () => {
    const invoice = await invoiceFrom({
      source: regen,
      settings: { source_id: regen.id, rate_cents: 1800, nte_cents: null },
      entries: [
        makeEntry('2026-10-30', '09:00:00', '10:00:00', 'domestic-support', 'domestic-support', {
          source_id: regen.id,
        }),
      ],
      prior_invoices: [],
    });
    const text = (await pdfOf(invoice, regen))[0]?.text ?? '';
    expect(text).toContain('REGEN-GO · Regen General Operating');
    expect(text).not.toContain('CONTRACT TRACKING');
    expect(text).not.toContain('Not-to-exceed');
  });
});

describe('long invoices still fit', () => {
  it('fits page 1 with every REGEN-GO budget line, many custom counts and a long address', async () => {
    const entries = regen.budget_lines.map((line, i) =>
      makeEntry(
        `2026-10-${String(i + 1).padStart(2, '0')}`,
        '09:00:00',
        '17:00:00',
        'outreach',
        line.id,
        {
          source_id: regen.id,
          counts: counts({
            contacts: 12,
            other: [{ label: `Custom count number ${String(i)}`, value: i + 1 }],
          }),
        },
      ),
    );
    const invoice = await invoiceFrom({
      source: regen,
      settings: { source_id: regen.id, rate_cents: 2237, nte_cents: null },
      profile: {
        name: 'Maria Guadalupe Hernández-Villalobos',
        initials: 'CC',
        mailing_address:
          '12345 West Very Long Street Name Road\nApartment 678\nSuperior, AZ 85173\nUSA',
        logo: null,
      },
      entries,
      prior_invoices: [],
    });
    const page = new PdfPage(LETTER.width, LETTER.height);
    const result = drawInvoicePage(page, invoice, 3);
    expect(result.spare).toBeGreaterThanOrEqual(0);
    const text = (await pdfOf(invoice, regen))[0]?.text ?? '';
    for (const line of regen.budget_lines) expect(text).toContain(line.name);
    expect(text).toContain('7 more in the entry log CSV');
  });

  it('keeps 7 dates on one sheet and cuts long notes, while the CSV keeps them (decision 0013)', async () => {
    const longNote = `${'Met with the family about the food bank, housing forms and rides. '.repeat(5)}END`;
    const entries: Entry[] = [];
    for (let day = 1; day <= 7; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      tisupp.tasks.slice(0, 12).forEach((task, i) => {
        const start = `${String(6 + i).padStart(2, '0')}:00:00`;
        const stop = `${String(6 + i).padStart(2, '0')}:30:00`;
        entries.push(
          makeEntry(date, start, stop, task.id, 'community-atlas', {
            notes: `${longNote} ${task.name} ${date}`,
          }),
        );
      });
    }
    const invoice = await invoiceFrom({ entries });
    const [timesheet] = paginateTimesheet(invoice, tisupp);
    if (!timesheet) throw new Error('no page');
    expect(timesheet.rows).toHaveLength(12);
    const result = drawTimesheetPage(
      new PdfPage(LETTER_LANDSCAPE.width, LETTER_LANDSCAPE.height),
      invoice,
      timesheet,
      undefined,
    );
    expect(result).toMatchObject({ size: 7, cut: true });
    expect(result.spare).toBeGreaterThanOrEqual(0);

    const pages = await pdfOf(invoice);
    expect(pages).toHaveLength(2);
    expect(pages[1]?.text).toContain('…');
    expect(pages[1]?.text).not.toContain('END');
    expect(csvText(timesheetCsv(invoice, tisupp))).toContain('END');
  });

  it('shrinks below 7 pt rather than cut hours when there are very many rows', async () => {
    const entries: Entry[] = [];
    tisupp.tasks.forEach((task, t) => {
      ['new-chws', 'chw-referrals'].forEach((line, l) => {
        const minute = String((t * 2 + l) % 60).padStart(2, '0');
        const hour = String(Math.floor((t * 2 + l) / 60) + 6).padStart(2, '0');
        entries.push(
          makeEntry('2026-10-01', `${hour}:${minute}:00`, `${hour}:${minute}:00`, task.id, line),
        );
      });
    });
    // Each entry needs at least 8 minutes; give them 10-minute slots across the day.
    const spaced = entries.map((e, i) => {
      const start = new Date(Date.UTC(2026, 9, 1, 13 + Math.floor((i * 10) / 60), (i * 10) % 60));
      const stop = new Date(start.getTime() + 9 * 60_000);
      const iso = (d: Date) => `${d.toISOString().slice(0, 19)}-07:00`;
      return { ...e, start: iso(start), stop: iso(stop), notes: '' };
    });
    const invoice = await invoiceFrom({ entries: spaced });
    const [timesheet] = paginateTimesheet(invoice, tisupp);
    if (!timesheet) throw new Error('no page');
    expect(timesheet.rows.length).toBe(42);
    const result = drawTimesheetPage(
      new PdfPage(LETTER_LANDSCAPE.width, LETTER_LANDSCAPE.height),
      invoice,
      timesheet,
      undefined,
    );
    expect(result.size).toBeLessThan(7);
    expect(result.spare).toBeGreaterThanOrEqual(0);
  });
});
