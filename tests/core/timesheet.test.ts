import { describe, expect, it } from 'vitest';
import { buildInvoiceDraft } from '../../src/core/invoice';
import { formatQuarters } from '../../src/core/money';
import { paginateTimesheet } from '../../src/core/timesheet';
import type { Entry } from '../../src/core/types';
import { makeEntry, must, sampleInput, tisupp } from './fixtures/wireframe-sample';

function pages(entries: Entry[]) {
  const result = buildInvoiceDraft(sampleInput({ entries }));
  if (!result.ok) throw new Error(result.reason);
  return { invoice: result.invoice, pages: paginateTimesheet(result.invoice, tisupp) };
}

function onDates(n: number): Entry[] {
  // n entries on n different dates, 1 h each, starting Oct 1.
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    return makeEntry(date, '09:00:00', '10:00:00', 'outreach', 'outreach-and-marketing');
  });
}

const hours = (cells: (number | null)[]) => cells.map((q) => (q === null ? '' : formatQuarters(q)));

describe('wireframe sample timesheet (SPEC §7)', () => {
  const sample = pages(sampleInput().entries as Entry[]).pages;

  it('has pages 2 and 3 of 3', () => {
    expect(sample.map((p) => [p.page_number, p.page_count])).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it('page 2 matches the SPEC §7 timesheet CSV sample', () => {
    const p = must(sample[0]);
    expect([p.first_date_index, p.last_date_index, p.date_count]).toEqual([1, 7, 8]);
    expect(p.dates).toEqual([
      '2026-10-20',
      '2026-10-22',
      '2026-10-23',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
    ]);
    expect(
      p.rows.map((r) => [
        r.task_name,
        r.core_competency,
        r.budget_line_name,
        ...hours(r.cells),
        formatQuarters(r.total),
        r.notes,
      ]),
    ).toEqual([
      [
        'Outreach',
        'Outreach',
        'Outreach and marketing',
        '0.50',
        '',
        '',
        '1.00',
        '',
        '1.50',
        '',
        '3.00',
        'Library table',
      ],
      [
        'Client follow up',
        'Service Coordination & Navigation',
        'CHW referrals',
        '',
        '',
        '',
        '',
        '',
        '',
        '1.75',
        '1.75',
        'By phone',
      ],
      [
        'Training / continuing education',
        'Professional Skills & Conduct',
        'New CHWs: training, stipends, field hours',
        '',
        '0.50',
        '0.50',
        '',
        '2.00',
        '',
        '',
        '3.00',
        'CHW module 3',
      ],
    ]);
    expect(hours(p.date_totals)).toEqual(['0.50', '0.50', '0.50', '1.00', '2.00', '1.50', '1.75']);
    expect(p.page_total).toBe(31);
  });

  it('page 2 subtotals follow source order (decision 0002)', () => {
    expect(
      must(sample[0]).subtotals.map((s) => [s.budget_line_name, formatQuarters(s.quarters)]),
    ).toEqual([
      ['New CHWs: training, stipends, field hours', '3.00'],
      ['CHW referrals', '1.75'],
      ['Outreach and marketing', '3.00'],
    ]);
  });

  it('page 3 matches the SPEC §7 timesheet CSV sample', () => {
    const p = must(sample[1]);
    expect([p.first_date_index, p.last_date_index]).toEqual([8, 8]);
    expect(p.dates).toEqual(['2026-10-30']);
    expect(
      p.rows.map((r) => [r.task_name, r.budget_line_name, ...hours(r.cells), r.notes]),
    ).toEqual([['Client check in', 'CHW referrals', '1.50', '']]);
    expect(p.page_total).toBe(6);
  });
});

describe('page splitting', () => {
  it.each([
    [1, [1]],
    [7, [7]],
    [8, [7, 1]],
    [14, [7, 7]],
    [15, [7, 7, 1]],
  ])('%i dates → pages of %j', (n, sizes) => {
    const { pages: ps } = pages(onDates(n));
    expect(ps.map((p) => p.dates.length)).toEqual(sizes);
    expect(ps.map((p) => p.page_count)).toEqual(sizes.map(() => sizes.length + 1));
    expect(ps.at(-1)?.last_date_index).toBe(n);
  });

  it('skips dates with no entries and puts several entries on one date in one column', () => {
    const entries = [
      makeEntry('2026-10-01', '09:00:00', '10:00:00', 'outreach', 'outreach-and-marketing'),
      makeEntry('2026-10-01', '13:00:00', '13:30:00', 'outreach', 'outreach-and-marketing'),
      makeEntry('2026-10-20', '09:00:00', '10:00:00', 'outreach', 'outreach-and-marketing'),
    ];
    const [p] = pages(entries).pages;
    expect(p?.dates).toEqual(['2026-10-01', '2026-10-20']);
    expect(p?.rows[0]?.cells).toEqual([6, 4]);
  });

  it('puts one task on two budget lines in two rows, task order first', () => {
    const entries = [
      makeEntry('2026-10-01', '09:00:00', '10:00:00', 'outreach', 'outreach-and-marketing'),
      makeEntry('2026-10-01', '10:00:00', '11:00:00', 'outreach', 'new-chws'),
      makeEntry('2026-10-01', '11:00:00', '12:00:00', 'advocacy', 'new-chws'),
    ];
    const [p] = pages(entries).pages;
    expect(p?.rows.map((r) => `${r.task_id}/${r.budget_line_id}`)).toEqual([
      'outreach/new-chws',
      'outreach/outreach-and-marketing',
      'advocacy/new-chws',
    ]);
  });

  it('joins notes oldest first, skipping blanks and repeats (decision 0003)', () => {
    const entries = [
      makeEntry('2026-10-02', '09:00:00', '10:00:00', 'outreach', 'new-chws', { notes: 'Park ' }),
      makeEntry('2026-10-01', '09:00:00', '10:00:00', 'outreach', 'new-chws', {
        notes: 'Library table',
      }),
      makeEntry('2026-10-01', '11:00:00', '12:00:00', 'outreach', 'new-chws', { notes: '  ' }),
      makeEntry('2026-10-03', '09:00:00', '10:00:00', 'outreach', 'new-chws', {
        notes: 'Library table',
      }),
      makeEntry('2026-10-04', '09:00:00', '10:00:00', 'outreach', 'new-chws', {
        notes: 'library table',
      }),
    ];
    expect(pages(entries).pages[0]?.rows[0]?.notes).toBe('Library table; Park; library table');
  });

  it('keeps notes per page', () => {
    const entries = onDates(8).map((e, i) => ({ ...e, notes: `Day ${String(i + 1)}` }));
    const ps = pages(entries).pages;
    expect(ps[1]?.rows[0]?.notes).toBe('Day 8');
  });

  it('reconciles with the invoice: page totals and subtotals add up to the lines', () => {
    const entries = [
      ...onDates(10),
      makeEntry('2026-10-03', '13:00:00', '14:15:00', 'client-check-in', 'chw-referrals'),
      makeEntry('2026-10-09', '13:00:00', '13:45:00', 'meetings', 'quarterly-partnership-meetings'),
    ];
    const { invoice, pages: ps } = pages(entries);
    expect(ps.reduce((sum, p) => sum + p.page_total, 0)).toBe(invoice.total_quarters);
    const byLine = new Map<string, number>();
    for (const s of ps.flatMap((p) => p.subtotals)) {
      byLine.set(s.budget_line_id, (byLine.get(s.budget_line_id) ?? 0) + s.quarters);
    }
    expect(Object.fromEntries(byLine)).toEqual(
      Object.fromEntries(invoice.lines.map((l) => [l.budget_line_id, l.quarters])),
    );
  });

  it('places a task a later source release dropped after the known ones', () => {
    const { invoice } = pages(onDates(1));
    const renamed = {
      entries: [
        ...invoice.entries,
        {
          ...must(invoice.entries[0]),
          id: 'x',
          task_id: 'retired-task',
          task_name: 'Retired task',
        },
      ],
    };
    const [p] = paginateTimesheet(renamed, tisupp);
    expect(p?.rows.map((r) => r.task_name)).toEqual(['Outreach', 'Retired task']);
  });

  it('returns no pages for no entries', () => {
    expect(paginateTimesheet({ entries: [] }, tisupp)).toEqual([]);
  });
});
