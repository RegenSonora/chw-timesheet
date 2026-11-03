// The wireframe sample: Carmen Cruz, TISUPP, 8 entries on 8 dates, 9.25 h, $185.00, CC-2026-004.
// Raw times come from the wireframes where they are shown; the rest are filled in to round to
// the hours on the timesheet page. Earlier invoices CC-2026-001 to 003 total $4,880.00.
import { emptyCounts } from '../../../src/core/counts';
import { checkEntryTimes } from '../../../src/core/time';
import type { InvoiceInput } from '../../../src/core/invoice';
import type { Counts, Entry, Invoice, OtherCount, RolesFile } from '../../../src/core/types';
import shippedRoles from '../../../src/roles/roles.json';
import { findFundingSource } from '../../../src/funding-sources';

export const tisupp = (() => {
  const source = findFundingSource('tisupp');
  if (!source) throw new Error('TISUPP source missing');
  return source;
})();

export const regen = (() => {
  const source = findFundingSource('regen-general-operating');
  if (!source) throw new Error('Regen General Operating source missing');
  return source;
})();

/** A value the test knows is there (the lint rules forbid `!`). */
export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing test value');
  return value;
}

export const at = (date: string, time: string) => `${date}T${time}-07:00`;

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** The shipped roles file and its count list. */
export const rolesFile = shippedRoles as RolesFile;
export const countDefs = rolesFile.counts;

export function findTestRole(id: string) {
  return must(rolesFile.roles.find((r) => r.id === id));
}

/** The five CHW counts data v3 had, which the sample uses. */
export interface LegacyCounts {
  contacts: number;
  referrals_given: number;
  referral_followups: number;
  rides_provided: number;
  applications_completed: number;
  other: OtherCount[];
}

/** Counts with the five CHW counts set (0 unless given), plus any other values by id. */
export function counts(
  partial: Partial<LegacyCounts> = {},
  values: Record<string, number> = {},
): Counts {
  const { other = [], ...fixed } = partial;
  return {
    ...emptyCounts(),
    values: {
      contacts: 0,
      referrals_given: 0,
      referral_followups: 0,
      rides_provided: 0,
      applications_completed: 0,
      ...fixed,
      ...values,
    },
    other,
  };
}

let nextId = 1000;

export function makeEntry(
  date: string,
  start: string,
  stop: string,
  task_id: string,
  budget_line_id: string,
  extra: Partial<Entry> = {},
): Entry {
  const startIso = at(date, start);
  // A stop earlier than the start is on the next day.
  const stopDate =
    stop < start
      ? new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
      : date;
  const stopIso = at(stopDate, stop);
  const times = checkEntryTimes(startIso, stopIso);
  return {
    id: uuid(nextId++),
    source_id: 'tisupp',
    role_id: null,
    start: startIso,
    stop: stopIso,
    entry_date: date,
    // One task holding all the billed hours; split entries pass `tasks` in `extra`.
    tasks: [{ task_id, quarters: times.ok ? times.quarters : 0 }],
    budget_line_id,
    counts: counts(),
    notes: '',
    invoice_id: null,
    created_at: startIso,
    updated_at: startIso,
    ...extra,
  };
}

const entry = (
  n: number,
  date: string,
  start: string,
  stop: string,
  task_id: string,
  budget_line_id: string,
  notes: string,
  c: Partial<LegacyCounts> = {},
): Entry => ({
  ...makeEntry(date, start, stop, task_id, budget_line_id),
  id: uuid(n),
  notes,
  counts: counts(c),
});

export const sampleEntries: Entry[] = [
  // Listed newest first, as Home shows them, so the builder's sort is exercised.
  entry(8, '2026-10-30', '09:12:04', '10:37:10', 'client-check-in', 'chw-referrals', '', {
    contacts: 1,
    referrals_given: 1,
  }),
  entry(7, '2026-10-29', '13:15:00', '15:00:00', 'client-follow-up', 'chw-referrals', 'By phone', {
    referral_followups: 2,
    referrals_given: 1,
    applications_completed: 1,
  }),
  entry(6, '2026-10-28', '10:00:00', '11:30:00', 'outreach', 'outreach-and-marketing', '', {
    contacts: 2,
    referrals_given: 1,
    rides_provided: 1,
    applications_completed: 1,
  }),
  entry(5, '2026-10-27', '09:00:00', '11:04:10', 'training-continuing-education', 'new-chws', ''),
  entry(
    4,
    '2026-10-26',
    '09:00:00',
    '10:02:30',
    'outreach',
    'outreach-and-marketing',
    'Library table',
    {
      contacts: 2,
    },
  ),
  entry(
    3,
    '2026-10-23',
    '13:00:00',
    '13:30:00',
    'training-continuing-education',
    'new-chws',
    'CHW module 3',
  ),
  entry(
    2,
    '2026-10-22',
    '13:00:00',
    '13:29:40',
    'training-continuing-education',
    'new-chws',
    'CHW module 3',
  ),
  entry(
    1,
    '2026-10-20',
    '10:00:00',
    '10:31:12',
    'outreach',
    'outreach-and-marketing',
    'Library table',
    {
      contacts: 1,
    },
  ),
];

/** A stand-in for an earlier TISUPP invoice: only the fields the builder reads matter. */
export function priorInvoice(
  sequence: number,
  total_cents: number,
  period: Counts,
  source = tisupp,
): Invoice {
  return {
    id: uuid(100 + sequence),
    number: `CC-2026-${String(sequence).padStart(3, '0')}`,
    sequence,
    kind: 'invoice',
    role: null,
    source: {
      id: source.id,
      code: source.code,
      name: source.name,
      version: source.version,
      certification_text: source.certification_text,
    },
    chw: { name: 'Carmen Cruz', initials: 'CC', mailing_address: '' },
    invoice_date: '2026-09-30',
    period_start: '2026-09-01',
    period_end: '2026-09-30',
    rate_cents: 2000,
    entries: [],
    lines: [],
    total_quarters: total_cents / 500,
    total_cents,
    counts_period: period,
    counts_all_time: period,
    count_defs: [],
    nte: { state: 'none' },
    canonical_version: 1,
    fingerprint: '0'.repeat(64),
    created_at: '2026-09-30T17:00:00-07:00',
    updated_at: '2026-09-30T17:00:00-07:00',
  };
}

// Before this invoice: 42 contacts, 19 referrals, 13 follow-ups, 8 rides, 12 applications.
export const samplePriorInvoices: Invoice[] = [
  priorInvoice(
    1,
    160_000,
    counts({
      contacts: 14,
      referrals_given: 6,
      referral_followups: 4,
      rides_provided: 3,
      applications_completed: 4,
    }),
  ),
  priorInvoice(
    2,
    168_000,
    counts({
      contacts: 15,
      referrals_given: 7,
      referral_followups: 5,
      rides_provided: 2,
      applications_completed: 4,
    }),
  ),
  priorInvoice(
    3,
    160_000,
    counts({
      contacts: 13,
      referrals_given: 6,
      referral_followups: 4,
      rides_provided: 3,
      applications_completed: 4,
    }),
  ),
];

export function sampleInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    id: uuid(500),
    now: '2026-10-31T16:00:00-07:00',
    invoice_date: '2026-10-31',
    source: tisupp,
    settings: { source_id: 'tisupp', rate_cents: 2000, nte_cents: 500_000 },
    profile: {
      name: 'Carmen Cruz',
      initials: 'CC',
      mailing_address: '',
      logo: null,
      role_id: null,
    },
    role: null,
    count_defs: countDefs,
    counter: { next: 4, locked: true },
    entries: sampleEntries,
    prior_invoices: samplePriorInvoices,
    ...overrides,
  };
}

/**
 * The sample with its Oct 30 entry (1:25:06 → 1.50 h) split: Client check in 1.00 h, then
 * Outreach 0.50 h (decision 0024). Totals stay 9.25 h and $185.00.
 */
export const splitSampleEntries: Entry[] = sampleEntries.map((e) =>
  e.id === uuid(8)
    ? {
        ...e,
        notes: 'Library table',
        tasks: [
          { task_id: 'client-check-in', quarters: 4 },
          { task_id: 'outreach', quarters: 2 },
        ],
      }
    : e,
);

export function splitSampleInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return sampleInput({ entries: splitSampleEntries, ...overrides });
}
