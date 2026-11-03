// Work Hours Report (decision 0026).
import { describe, expect, it } from 'vitest';
import { buildInvoiceDraft } from '../../src/core/invoice';
import type { Invoice } from '../../src/core/types';
import { workHoursReport, yearsBefore, type ReportForm } from '../../src/core/work-hours';
import shipped from '../../src/funding-sources/tisupp.json';
import adhs from '../../src/reports/adhs-chw-attestation.json';
import {
  makeEntry,
  must,
  priorInvoice,
  counts,
  regen,
  splitSampleInput,
  uuid,
} from './fixtures/wireframe-sample';

const form: ReportForm = adhs;

function invoice(overrides: Parameters<typeof splitSampleInput>[0] = {}): Invoice {
  const result = buildInvoiceDraft(splitSampleInput(overrides));
  if (!result.ok) throw new Error(result.reason);
  return { ...result.invoice, fingerprint: '0'.repeat(64) };
}

const row = (r: ReturnType<typeof workHoursReport>, name: string) =>
  must(r.rows.find((x) => x.name === name));

describe('the ADHS form layout (src/reports/adhs-chw-attestation.json)', () => {
  it("has the form's 11 core competencies in the form's order", () => {
    expect(form.rows.map((r) => r.name)).toEqual([
      'Communication Skills',
      'Capacity-Building',
      'Outreach',
      'Interpersonal and Relationship Building',
      'Advocacy',
      'Individual and Community Assessment',
      'Service Coordination and Navigation',
      'Education and Facilitation',
      'Professional Skills and Conduct',
      'Evaluation and Research Skills',
      'Knowledge Base',
    ]);
    expect(form.window_years).toBe(3);
  });

  it('maps every core competency of the shipped TISUPP file to exactly one row', () => {
    const competencies = new Set(shipped.tasks.map((t) => t.core_competency));
    for (const c of competencies) {
      expect(
        form.rows.filter((r) => r.competencies.includes(c)),
        c,
      ).toHaveLength(1);
    }
  });
});

describe('yearsBefore', () => {
  it('goes back whole years, and Feb 29 to Feb 28 when needed', () => {
    expect(yearsBefore('2026-11-02', 3)).toBe('2023-11-02');
    expect(yearsBefore('2028-02-29', 3)).toBe('2025-02-28');
    expect(yearsBefore('2028-02-29', 4)).toBe('2024-02-29');
  });
});

describe('workHoursReport', () => {
  const sample = invoice();
  const report = workHoursReport(form, [sample], ['tisupp'], '2026-11-02');

  it("sums each task share into its competency's row, in the form's order", () => {
    expect(report.rows.map((r) => [r.name, r.quarters])).toEqual([
      ['Communication Skills', 0],
      ['Capacity-Building', 0],
      // Oct 20, 26, 28 Outreach (2 + 4 + 6) plus the Oct 30 split's 0.5 h.
      ['Outreach', 14],
      ['Interpersonal and Relationship Building', 4],
      ['Advocacy', 0],
      ['Individual and Community Assessment', 0],
      ['Service Coordination and Navigation', 7],
      ['Education and Facilitation', 0],
      ['Professional Skills and Conduct', 12],
      ['Evaluation and Research Skills', 0],
      ['Knowledge Base', 0],
    ]);
    expect(report.total_quarters).toBe(sample.total_quarters);
    expect(report.other.quarters).toBe(0);
  });

  it('lists each date once, oldest first', () => {
    expect(row(report, 'Outreach').dates).toEqual([
      '2026-10-20',
      '2026-10-26',
      '2026-10-28',
      '2026-10-30',
    ]);
    expect(row(report, 'Interpersonal and Relationship Building').dates).toEqual(['2026-10-30']);
    expect(row(report, 'Advocacy').dates).toEqual([]);
  });

  it('states the window, the dates worked and the invoices used', () => {
    expect(report).toMatchObject({
      window_start: '2023-11-02',
      made_on: '2026-11-02',
      first_date: '2026-10-20',
      last_date: '2026-10-30',
      invoice_numbers: ['CC-2026-004'],
    });
  });

  it('leaves out hours older than three years and other sources', () => {
    const old = invoice({
      id: uuid(600),
      counter: { next: 1, locked: true },
      entries: [makeEntry('2023-11-01', '09:00:00', '10:00:00', 'outreach', 'chw-referrals')],
    });
    const other: Invoice = { ...priorInvoice(9, 2000, counts(), regen), entries: sample.entries };
    const r = workHoursReport(form, [old, sample, other], ['tisupp'], '2026-11-02');
    expect(r.total_quarters).toBe(sample.total_quarters);
    expect(r.invoice_numbers).toEqual(['CC-2026-004']);
    // The day exactly three years back still counts.
    expect(workHoursReport(form, [old], ['tisupp'], '2026-11-01').total_quarters).toBe(4);
  });

  it('counts competencies the form does not list under Other', () => {
    const odd = structuredClone(sample);
    const share = must(must(odd.entries[0]).tasks[0]);
    share.core_competency = 'Something new';
    const r = workHoursReport(form, [odd], ['tisupp'], '2026-11-02');
    expect(r.other).toEqual({ name: 'Other', quarters: share.quarters, dates: ['2026-10-20'] });
    expect(r.total_quarters).toBe(sample.total_quarters);
  });

  it('combines every source it is given (decision 0032)', () => {
    const other: Invoice = { ...priorInvoice(9, 2000, counts(), regen), entries: sample.entries };
    const both = workHoursReport(form, [sample, other], ['tisupp', regen.id], '2026-11-02');
    expect(both.total_quarters).toBe(sample.total_quarters * 2);
    expect(both.invoice_numbers).toEqual([other.number, sample.number].sort());
    expect(workHoursReport(form, [sample, other], [regen.id], '2026-11-02').total_quarters).toBe(
      sample.total_quarters,
    );
  });

  it('with no invoices: every row at 0 and no dates', () => {
    const r = workHoursReport(form, [], ['tisupp'], '2026-11-02');
    expect(r.rows.every((x) => x.quarters === 0 && x.dates.length === 0)).toBe(true);
    expect(r).toMatchObject({ total_quarters: 0, first_date: null, last_date: null });
  });
});
