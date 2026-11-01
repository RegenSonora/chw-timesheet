import { describe, expect, it } from 'vitest';
import { entriesCsvName, pdfName, timesheetCsvName } from '../../src/files/names';
import { dateRange, longDate, monthDay, weekday } from '../../src/files/text';
import { sampleInvoice } from './helpers';

describe('file names (SPEC §7, decision 0006)', () => {
  it('match the spec for the wireframe sample', async () => {
    const invoice = await sampleInvoice();
    expect(pdfName(invoice)).toBe('TISUPP_CC-2026-004_2026-10-20_to_2026-10-30.pdf');
    expect(timesheetCsvName(invoice)).toBe('TISUPP_CC-2026-004_timesheet.csv');
    expect(entriesCsvName(invoice)).toBe('TISUPP_CC-2026-004_entries.csv');
  });

  it('use the short code', () => {
    const invoice = {
      number: 'CC-2026-005',
      period_start: '2026-11-02',
      period_end: '2026-11-02',
      source: { code: 'REGEN-GO' },
    };
    expect(entriesCsvName(invoice)).toBe('REGEN-GO_CC-2026-005_entries.csv');
  });
});

describe('printed dates', () => {
  it('formats the way the wireframes show', () => {
    expect(longDate('2026-10-31')).toBe('Oct 31, 2026');
    expect(dateRange('2026-10-20', '2026-10-30')).toBe('Oct 20 – Oct 30, 2026');
    expect(dateRange('2026-12-28', '2027-01-04')).toBe('Dec 28, 2026 – Jan 4, 2027');
    expect(dateRange('2026-10-30', '2026-10-30')).toBe('Oct 30, 2026');
    expect(weekday('2026-10-20')).toBe('Tue');
    expect(monthDay('2026-10-20')).toBe('10/20');
    expect(monthDay('2026-01-05')).toBe('1/5');
  });

  it('refuses anything but a date', () => {
    expect(() => longDate('Oct 31')).toThrow();
  });
});
