// Work Hours Report files (decision 0026): PDF like the ADHS form, page 1 as shapes, CSV.
import { describe, expect, it } from 'vitest';
import { workHoursReport, type ReportForm } from '../../src/core/work-hours';
import {
  buildWorkHoursFiles,
  datesText,
  splitName,
  usDate,
  workHoursPageShapes,
  type ReportDetails,
} from '../../src/files';
import adhs from '../../src/reports/adhs-chw-attestation.json';
import { makeEntry, splitSampleEntries } from '../core/fixtures/wireframe-sample';
import { csvText, invoiceFrom } from './helpers';
import { readPdf } from './pdf-reader';

const form: ReportForm = adhs;
const details: ReportDetails = {
  chw_name: 'Carmen Cruz Lopez',
  source_code: 'TISUPP',
  funding_line:
    "Trauma-Informed Substance Use Prevention Program (TISUPP), funded by the Governor's Office of Youth, Faith and Family through Arizona State University. Contracted through Regenerating Sonora, Inc.",
  made_at: '2026-11-02T16:00:00-07:00',
};

async function sample() {
  const invoice = await invoiceFrom({ entries: splitSampleEntries });
  return workHoursReport(form, [invoice], 'tisupp', '2026-11-02');
}

/** Minimal RFC 4180 reader for the checks below. */
function parse(text: string): string[][] {
  return text
    .split('\r\n')
    .slice(0, -1)
    .map((line) =>
      [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)].map((m) => {
        const cell = m[1] ?? '';
        return cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;
      }),
    );
}

describe('helpers', () => {
  it('writes dates as on the form and splits the name at the first space', () => {
    expect(usDate('2026-10-20')).toBe('10/20/2026');
    expect(datesText(['2026-10-20', '2026-10-26'])).toBe('10/20/2026, 10/26/2026');
    expect(splitName('  Carmen  Cruz Lopez ')).toEqual({ first: 'Carmen', last: 'Cruz Lopez' });
    expect(splitName('Carmen')).toEqual({ first: 'Carmen', last: '' });
  });
});

describe('Work Hours Report files', () => {
  it('names the PDF and CSV after the source and the day', async () => {
    const files = buildWorkHoursFiles(form, await sample(), details);
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ['TISUPP_Work_Hours_Report_2026-11-02.pdf', 'application/pdf'],
      ['TISUPP_Work_Hours_Report_2026-11-02.csv', 'text/csv'],
    ]);
  });

  it("CSV: header block, then the form's 11 rows with hours and dates, then the total", async () => {
    const [, csv] = buildWorkHoursFiles(form, await sample(), details);
    const rows = parse(csvText(csv?.bytes ?? new Uint8Array()));
    expect(rows.slice(0, 9)).toEqual([
      ['Report', 'CHW Work Hours Report'],
      [
        'For',
        'Community Health Worker Hours Worked/Volunteered Attestation Form (Arizona Department of Health Services, revised 06.16.2025)',
      ],
      ['Legal first name', 'Carmen'],
      ['Legal last name', 'Cruz Lopez'],
      ['Organization', 'Regenerating Sonora, Inc., PO Box 154, Superior, AZ 85173'],
      ['Funding source', details.funding_line],
      ['Period', '11/02/2023', '11/02/2026'],
      ['Hours worked', '9.25'],
      ['From', 'invoice CC-2026-004'],
    ]);
    const table = rows.slice(10);
    expect(table[0]).toEqual(['Core Competency', 'Number of Hours', 'Dates Completed']);
    expect(table.slice(1, 12).map((r) => r[0])).toEqual(form.rows.map((r) => r.name));
    expect(table.find((r) => r[0] === 'Outreach')).toEqual([
      'Outreach',
      '3.50',
      '10/20/2026, 10/26/2026, 10/28/2026, 10/30/2026',
    ]);
    expect(table.find((r) => r[0] === 'Advocacy')).toEqual(['Advocacy', '0.00', '']);
    expect(table[12]).toEqual(['Total', '9.25', '']);
    expect(table).toHaveLength(13);
  });

  it('PDF: one Letter page with selectable text in the form order', async () => {
    const [pdf] = buildWorkHoursFiles(form, await sample(), details);
    const pages = await readPdf(pdf?.bytes ?? new Uint8Array());
    expect(pages).toHaveLength(1);
    const page = pages[0];
    expect([page?.width, page?.height]).toEqual([612, 792]);
    const text = page?.text ?? '';
    for (const s of [
      'CHW WORK HOURS REPORT',
      'APPLICANT INFORMATION',
      'Carmen',
      'Cruz Lopez',
      'ORGANIZATION INFORMATION',
      'Regenerating Sonora, Inc., PO Box 154, Superior, AZ 85173',
      'Core Competency',
      'Dates Completed',
      '10/20/2026, 10/26/2026, 10/28/2026, 10/30/2026',
      'Total',
      'Page 1 of 1',
      'Made by Regen Time Tracking on',
    ]) {
      expect(text, s).toContain(s);
    }
    const order = form.rows.map((r) => text.indexOf(r.name.split(' ')[0] ?? ''));
    expect(order.every((i) => i > 0)).toBe(true);
  });

  it('PDF: a long list of dates continues the table on more pages', async () => {
    // 500 one-hour Outreach entries on different days.
    const entries = Array.from({ length: 500 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
      return makeEntry(date, '09:00:00', '10:00:00', 'outreach', 'chw-referrals');
    });
    const invoice = await invoiceFrom({ entries });
    const report = workHoursReport(form, [invoice], 'tisupp', '2026-11-02');
    const [pdf] = buildWorkHoursFiles(form, report, details);
    const pages = await readPdf(pdf?.bytes ?? new Uint8Array());
    expect(pages.length).toBeGreaterThan(1);
    const all = pages.map((p) => p.text).join(' ');
    // Every one of the 500 dates is printed, across the page break.
    for (const e of entries) expect(all).toContain(usDate(e.entry_date));
    expect(all).toContain('Outreach (continued)');
    expect(pages[pages.length - 1]?.text).toContain('Total 500.00');
    expect(pages[0]?.text).toContain(`Page 1 of ${String(pages.length)}`);
  });

  it('page 1 as shapes matches the PDF page 1 text, for the picture', async () => {
    const report = await sample();
    const shapes = workHoursPageShapes(form, report, details);
    expect([shapes.width, shapes.height]).toEqual([612, 792]);
    const texts = shapes.shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
    expect(texts).toContain('APPLICANT INFORMATION');
    expect(texts).toContain('Total');
  });
});
