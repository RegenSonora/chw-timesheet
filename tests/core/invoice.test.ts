import { describe, expect, it } from 'vitest';
import { sumCounts } from '../../src/core/counts';
import {
  buildInvoiceDraft,
  certificationText,
  createInvoice,
  invoiceRoleId,
  uninvoicedEntries,
} from '../../src/core/invoice';
import type { InvoiceInput } from '../../src/core/invoice';
import { verifyFingerprint } from '../../src/core/fingerprint';
import {
  counts,
  countDefs,
  findTestRole,
  makeEntry,
  must,
  priorInvoice,
  regen,
  sampleEntries,
  sampleInput,
  splitSampleInput,
  tisupp,
  uuid,
} from './fixtures/wireframe-sample';

function draft(input: InvoiceInput) {
  const result = buildInvoiceDraft(input);
  if (!result.ok) throw new Error(`draft failed: ${result.reason}`);
  return result;
}

describe('wireframe sample invoice (SPEC §6)', () => {
  const { invoice, counter, entry_ids } = draft(sampleInput());

  it('is CC-2026-004 for Oct 20 – Oct 30 at $20.00', () => {
    expect(invoice.number).toBe('CC-2026-004');
    expect(invoice.sequence).toBe(4);
    expect(invoice.invoice_date).toBe('2026-10-31');
    expect(invoice.period_start).toBe('2026-10-20');
    expect(invoice.period_end).toBe('2026-10-30');
    expect(invoice.rate_cents).toBe(2000);
    expect(counter).toEqual({ next: 5, locked: true });
  });

  it('bills 8 entries, 9.25 h, $185.00, oldest first', () => {
    expect(entry_ids).toHaveLength(8);
    expect(invoice.entries.map((e) => e.entry_date)).toEqual([
      '2026-10-20',
      '2026-10-22',
      '2026-10-23',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
    ]);
    expect(invoice.total_quarters).toBe(37);
    expect(invoice.total_cents).toBe(18_500);
  });

  it('has one line per budget line, in source order (decision 0002)', () => {
    expect(invoice.lines).toEqual([
      {
        budget_line_id: 'new-chws',
        budget_line_name: 'New CHWs: training, stipends, field hours',
        quarters: 12,
        rate_cents: 2000,
        amount_cents: 6000,
      },
      {
        budget_line_id: 'chw-referrals',
        budget_line_name: 'CHW referrals',
        quarters: 13,
        rate_cents: 2000,
        amount_cents: 6500,
      },
      {
        budget_line_id: 'outreach-and-marketing',
        budget_line_name: 'Outreach and marketing',
        quarters: 12,
        rate_cents: 2000,
        amount_cents: 6000,
      },
    ]);
  });

  it('is $65.00 over a $5,000.00 limit after $4,880.00 billed before', () => {
    expect(invoice.nte).toEqual({
      state: 'tracked',
      nte_cents: 500_000,
      billed_before_cents: 488_000,
      this_invoice_cents: 18_500,
      remaining_cents: -6500,
      over: true,
    });
  });

  it('counts 6/3/2/1/2 this period and 48/22/15/9/14 all time', () => {
    expect(invoice.counts_period).toEqual(
      counts({
        contacts: 6,
        referrals_given: 3,
        referral_followups: 2,
        rides_provided: 1,
        applications_completed: 2,
      }),
    );
    expect(invoice.counts_all_time).toEqual(
      counts({
        contacts: 48,
        referrals_given: 22,
        referral_followups: 15,
        rides_provided: 9,
        applications_completed: 14,
      }),
    );
  });

  it('freezes names, competencies and the 1:25:06 entry as 1.50 h', () => {
    const last = invoice.entries[7];
    expect(last).toMatchObject({
      start: '2026-10-30T09:12:04-07:00',
      stop: '2026-10-30T10:37:10-07:00',
      quarters: 6,
      tasks: [
        {
          task_id: 'client-check-in',
          task_name: 'Client check in',
          core_competency: 'Interpersonal & Relationship-Building',
          quarters: 6,
        },
      ],
      budget_line_name: 'CHW referrals',
    });
  });

  it('snapshots the source, CHW and certification', () => {
    expect(invoice.source).toEqual({
      id: 'tisupp',
      code: 'TISUPP',
      name: 'Trauma-Informed Substance Use Prevention Program',
      version: tisupp.version,
      certification_text: tisupp.certification_text,
    });
    expect(invoice.chw).toEqual({ name: 'Carmen Cruz', initials: 'CC', mailing_address: '' });
  });
});

describe('several tasks per entry (decision 0024)', () => {
  const { invoice } = draft(splitSampleInput());

  it('freezes each task share with its names, in the order checked', () => {
    expect(must(invoice.entries[7]).tasks).toEqual([
      {
        task_id: 'client-check-in',
        task_name: 'Client check in',
        core_competency: 'Interpersonal & Relationship-Building',
        quarters: 4,
      },
      { task_id: 'outreach', task_name: 'Outreach', core_competency: 'Outreach', quarters: 2 },
    ]);
  });

  it('leaves hours, lines and the total as they were', () => {
    const plain = draft(sampleInput()).invoice;
    expect(invoice.total_quarters).toBe(plain.total_quarters);
    expect(invoice.total_cents).toBe(plain.total_cents);
    expect(invoice.lines).toEqual(plain.lines);
  });

  it('refuses an entry whose shares do not add up to its billed hours', () => {
    for (const tasks of [
      [
        { task_id: 'client-check-in', quarters: 4 },
        { task_id: 'outreach', quarters: 1 },
      ],
      [
        { task_id: 'client-check-in', quarters: 6 },
        { task_id: 'outreach', quarters: 0 },
      ],
      [{ task_id: 'no-such-task', quarters: 6 }],
      [],
    ]) {
      const entries = sampleEntries.map((e) => (e.id === uuid(8) ? { ...e, tasks } : e));
      expect(buildInvoiceDraft(sampleInput({ entries })), JSON.stringify(tasks)).toEqual({
        ok: false,
        reason: 'bad_entry',
        entry_id: uuid(8),
      });
    }
  });

  it('new invoices use the current canonical form (v3) and verify', async () => {
    const result = await createInvoice(splitSampleInput());
    if (!result.ok) throw new Error(result.reason);
    expect(result.invoice.canonical_version).toBe(3);
    expect(await verifyFingerprint(result.invoice)).toBe(true);
  });
});

describe('which entries are billed', () => {
  it('uses only uninvoiced entries of this source', () => {
    const invoiced = {
      ...must(sampleEntries[0]),
      invoice_id: 'old',
    } as (typeof sampleEntries)[number];
    const otherSource = makeEntry(
      '2026-10-21',
      '09:00:00',
      '10:00:00',
      'domestic-support',
      'domestic-support',
      {
        source_id: 'regen-general-operating',
      },
    );
    const entries = [invoiced, ...sampleEntries.slice(1), otherSource];
    expect(uninvoicedEntries(entries, 'tisupp')).toHaveLength(7);
    const { invoice } = draft(sampleInput({ entries }));
    expect(invoice.entries).toHaveLength(7);
    expect(invoice.entries.some((e) => e.id === otherSource.id)).toBe(false);
    expect(invoice.period_end).toBe('2026-10-29');
  });

  it('refuses when nothing is waiting', () => {
    expect(buildInvoiceDraft(sampleInput({ entries: [] }))).toEqual({
      ok: false,
      reason: 'no_entries',
    });
    const allInvoiced = sampleEntries.map((e) => ({ ...e, invoice_id: 'x' }));
    expect(buildInvoiceDraft(sampleInput({ entries: allInvoiced }))).toEqual({
      ok: false,
      reason: 'no_entries',
    });
  });

  it('refuses an entry this source does not know, or one with bad times', () => {
    const stray = makeEntry('2026-10-21', '09:00:00', '10:00:00', 'domestic-support', 'new-chws');
    expect(buildInvoiceDraft(sampleInput({ entries: [stray] }))).toEqual({
      ok: false,
      reason: 'bad_entry',
      entry_id: stray.id,
    });
    const short = makeEntry('2026-10-21', '09:00:00', '09:05:00', 'outreach', 'new-chws');
    expect(buildInvoiceDraft(sampleInput({ entries: [short] }))).toMatchObject({
      reason: 'bad_entry',
    });
    const misdated = makeEntry('2026-10-21', '09:00:00', '10:00:00', 'outreach', 'new-chws', {
      entry_date: '2026-10-22',
    });
    expect(buildInvoiceDraft(sampleInput({ entries: [misdated] }))).toMatchObject({
      reason: 'bad_entry',
    });
  });

  it('dates a midnight-crossing entry by its start', () => {
    const late = makeEntry('2026-10-31', '23:00:00', '01:00:00', 'outreach', 'new-chws');
    const { invoice } = draft(sampleInput({ entries: [late], invoice_date: '2026-11-01' }));
    expect(invoice.period_start).toBe('2026-10-31');
    expect(invoice.period_end).toBe('2026-10-31');
    expect(invoice.total_quarters).toBe(8);
  });
});

describe('checks before building', () => {
  it('needs a rate, matching settings, good initials and a real date', () => {
    const base = sampleInput();
    expect(buildInvoiceDraft({ ...base, settings: { ...base.settings, rate_cents: 0 } })).toEqual({
      ok: false,
      reason: 'no_rate',
    });
    expect(
      buildInvoiceDraft({
        ...base,
        settings: { ...base.settings, source_id: 'regen-general-operating' },
      }),
    ).toEqual({ ok: false, reason: 'bad_settings' });
    expect(buildInvoiceDraft({ ...base, profile: { ...base.profile, initials: 'cc' } })).toEqual({
      ok: false,
      reason: 'bad_initials',
    });
    expect(buildInvoiceDraft({ ...base, invoice_date: '2026-02-30' })).toEqual({
      ok: false,
      reason: 'bad_date',
    });
  });
});

describe('invoice number', () => {
  it('takes YYYY from the invoice date across New Year', () => {
    const { invoice } = draft(
      sampleInput({ invoice_date: '2027-01-02', counter: { next: 4, locked: true } }),
    );
    expect(invoice.number).toBe('CC-2027-004');
  });

  it('uses the shared counter whichever source is invoiced, and new initials', () => {
    const regenEntry = makeEntry(
      '2026-10-21',
      '09:00:00',
      '10:00:00',
      'domestic-support',
      'domestic-support',
      {
        source_id: 'regen-general-operating',
      },
    );
    const { invoice, counter } = draft(
      sampleInput({
        source: regen,
        settings: { source_id: 'regen-general-operating', rate_cents: 2000, nte_cents: null },
        entries: [regenEntry],
        counter: { next: 5, locked: true },
        profile: {
          name: 'Carmen Cruz',
          initials: 'CM',
          mailing_address: '',
          logo: null,
          role_id: null,
        },
      }),
    );
    expect(invoice.number).toBe('CM-2026-005');
    expect(counter.next).toBe(6);
  });
});

describe('NTE tracker (SPEC §6)', () => {
  it('shows "not entered" when TISUPP has no NTE yet', () => {
    const base = sampleInput();
    expect(draft({ ...base, settings: { ...base.settings, nte_cents: null } }).invoice.nte).toEqual(
      {
        state: 'not_entered',
      },
    );
  });

  it('has no tracker for a source without an NTE, even if one was typed', () => {
    const e = makeEntry(
      '2026-10-21',
      '09:00:00',
      '10:00:00',
      'domestic-support',
      'domestic-support',
      {
        source_id: 'regen-general-operating',
      },
    );
    const { invoice } = draft(
      sampleInput({
        source: regen,
        settings: { source_id: 'regen-general-operating', rate_cents: 2000, nte_cents: 100 },
        entries: [e],
      }),
    );
    expect(invoice.nte).toEqual({ state: 'none' });
  });

  it('is not over at exactly the limit', () => {
    const base = sampleInput();
    const nte = draft({ ...base, settings: { ...base.settings, nte_cents: 488_000 + 18_500 } })
      .invoice.nte;
    expect(nte).toMatchObject({ remaining_cents: 0, over: false });
  });

  it('counts only earlier invoices for this source as billed before', () => {
    const regenInvoice = priorInvoice(9, 99_900, counts({ contacts: 50 }), regen);
    const { invoice } = draft(sampleInput({ prior_invoices: [regenInvoice] }));
    expect(invoice.nte).toMatchObject({
      billed_before_cents: 0,
      remaining_cents: 481_500,
      over: false,
    });
    expect(invoice.counts_all_time.values['contacts']).toBe(6);
  });

  it('uses the NTE as it is now (edits are allowed)', () => {
    const base = sampleInput();
    const nte = draft({ ...base, settings: { ...base.settings, nte_cents: 1_000_000 } }).invoice
      .nte;
    expect(nte).toMatchObject({ nte_cents: 1_000_000, remaining_cents: 493_500, over: false });
  });
});

describe('rate (SPEC §4)', () => {
  it('bills every entry at the rate in effect, $22.37 rounded per line', () => {
    const base = sampleInput();
    const { invoice } = draft({ ...base, settings: { ...base.settings, rate_cents: 2237 } });
    // 12 q → 6711; 13 q → 7270.25 → 7270; 12 q → 6711
    expect(invoice.lines.map((l) => l.amount_cents)).toEqual([6711, 7270, 6711]);
    expect(invoice.total_cents).toBe(20_692);
    expect(invoice.lines.every((l) => l.rate_cents === 2237)).toBe(true);
  });
});

describe('custom counts', () => {
  it('merge by label ignoring case and spaces, keep the first spelling, drop zeros', () => {
    expect(
      sumCounts([
        counts({
          other: [
            { label: 'Food boxes', value: 2 },
            { label: 'Library cards', value: 0 },
          ],
        }),
        counts({ other: [{ label: ' food Boxes ', value: 3 }] }),
      ]).other,
    ).toEqual([{ label: 'Food boxes', value: 5 }]);
  });
});

describe('kind, role and count labels (roles plan R3)', () => {
  it('is an invoice with no role before a role is picked', () => {
    const { invoice } = draft(sampleInput());
    expect(invoice.kind).toBe('invoice');
    expect(invoice.role).toBeNull();
  });

  it('freezes a contractor role and stays an invoice', () => {
    const { invoice } = draft(sampleInput({ role: findTestRole('chw-tc01') }));
    expect(invoice.kind).toBe('invoice');
    expect(invoice.role).toEqual({
      id: 'chw-tc01',
      code: 'CHW-TC01',
      name: 'CHW Trainee (Contractor)',
      employment: 'contractor',
      chw: true,
    });
  });

  it('is a timesheet for an employee role', () => {
    const { invoice } = draft(sampleInput({ role: findTestRole('chw-te01') }));
    expect(invoice.kind).toBe('timesheet');
    expect(invoice.role?.employment).toBe('employee');
    expect(invoice.total_cents).toBe(18_500);
  });

  it('freezes the labels and units of counts with a value, in list order', () => {
    const entries = sampleEntries.map((e, i) =>
      i === 0 ? { ...e, counts: counts({ contacts: 1 }, { water_capacity_added: 50 }) } : e,
    );
    const { invoice } = draft(sampleInput({ entries }));
    expect(invoice.count_defs).toEqual([
      { id: 'contacts', label: 'Contacts' },
      { id: 'referrals_given', label: 'Referrals given' },
      { id: 'referral_followups', label: 'Referral follow-ups' },
      { id: 'rides_provided', label: 'Rides provided' },
      { id: 'applications_completed', label: 'Applications completed' },
      { id: 'water_capacity_added', label: 'Water capacity added', unit: 'gal' },
    ]);
    expect(invoice.counts_period.values['water_capacity_added']).toBe(50);
  });

  it('leaves out counts that are 0 in the period and all time', () => {
    const entries = sampleEntries.map((e) => ({ ...e, counts: counts() }));
    const { invoice } = draft(sampleInput({ entries, prior_invoices: [] }));
    expect(invoice.count_defs).toEqual([]);
    expect(countDefs.length).toBeGreaterThan(5);
  });
});

describe('sumCounts over counts by id', () => {
  it('adds ids only some entries have', () => {
    expect(
      sumCounts([
        { values: { trees_planted: 2 }, other: [] },
        { values: { trees_planted: 3, trees_removed: 1 }, other: [] },
        { values: {}, other: [] },
      ]),
    ).toEqual({ values: { trees_planted: 5, trees_removed: 1 }, other: [] });
  });
});

describe('createInvoice', () => {
  it('adds a fingerprint that verifies', async () => {
    const result = await createInvoice(sampleInput());
    if (!result.ok) throw new Error(result.reason);
    expect(result.invoice.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyFingerprint(result.invoice)).toBe(true);
  });

  it('passes problems through', async () => {
    expect(await createInvoice(sampleInput({ entries: [] }))).toEqual({
      ok: false,
      reason: 'no_entries',
    });
  });

  it('does not change its inputs', async () => {
    const input = sampleInput();
    const before = structuredClone(input);
    await createInvoice(input);
    expect(input).toEqual(before);
  });
});

describe('certification text by role (decision 0031)', () => {
  const employee = findTestRole('chw-te01');
  const contractor = findTestRole('chw-tc01');

  it('employees sign the source employee text, contractors the contractor text', () => {
    expect(certificationText(tisupp, employee)).toBe(tisupp.employee_certification_text);
    expect(certificationText(tisupp, contractor)).toBe(tisupp.certification_text);
    expect(certificationText(tisupp, null)).toBe(tisupp.certification_text);
  });

  it('a role overrides either text, and an employee falls back to the contractor text', () => {
    expect(certificationText(tisupp, { ...employee, employee_certification_text: 'E' })).toBe('E');
    expect(certificationText(tisupp, { ...contractor, certification_text: 'C' })).toBe('C');
    const noEmployeeText = { ...tisupp };
    delete noEmployeeText.employee_certification_text;
    expect(certificationText(noEmployeeText, employee)).toBe(tisupp.certification_text);
  });

  it('a timesheet tracks no not-to-exceed amount', async () => {
    const result = await createInvoice(sampleInput({ role: employee }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.invoice.nte).toEqual({ state: 'none' });
  });

  it('a new timesheet freezes the employee text and seals it with form v3', async () => {
    const result = await createInvoice(sampleInput({ role: employee }));
    if (!result.ok) throw new Error(result.reason);
    expect(result.invoice.source.certification_text).toBe(tisupp.employee_certification_text);
    expect(result.invoice.canonical_version).toBe(3);
  });
});

describe('hours keep the role they were logged under (roles plan R7)', () => {
  // The two oldest entries were logged as an employee; the role then became a contractor one.
  const entries = [...sampleEntries]
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((e, i) => ({ ...e, role_id: i < 2 ? 'chw-te01' : 'chw-tc01' }));

  it('the next invoice takes the role of the oldest waiting entry', () => {
    expect(invoiceRoleId(entries, 'tisupp')).toBe('chw-te01');
    expect(invoiceRoleId(entries.slice(2), 'tisupp')).toBe('chw-tc01');
    expect(invoiceRoleId([], 'tisupp')).toBeUndefined();
  });

  it("bills only that role's hours, as that role's kind; the rest wait", () => {
    const first = buildInvoiceDraft(
      sampleInput({ entries, role: findTestRole('chw-te01'), entry_role_id: 'chw-te01' }),
    );
    if (!first.ok) throw new Error(first.reason);
    expect(first.invoice.kind).toBe('timesheet');
    expect(first.entry_ids).toEqual([entries[0]?.id, entries[1]?.id]);

    const second = buildInvoiceDraft(
      sampleInput({ entries, role: findTestRole('chw-tc01'), entry_role_id: 'chw-tc01' }),
    );
    if (!second.ok) throw new Error(second.reason);
    expect(second.invoice.kind).toBe('invoice');
    expect(second.entry_ids).toHaveLength(entries.length - 2);
  });

  it('bills every waiting entry when no role id is given', () => {
    const all = buildInvoiceDraft(sampleInput({ entries }));
    expect(all.ok && all.entry_ids).toHaveLength(entries.length);
  });
});

describe('an entry whose task the role no longer lists (roles plan R7)', () => {
  it('is still invoiced from the source file', () => {
    const entry = makeEntry('2026-10-20', '09:00:00', '10:00:00', 'outreach', 'chw-referrals', {
      role_id: 'chw-tc01',
    });
    const draft = buildInvoiceDraft(
      sampleInput({ entries: [entry], role: findTestRole('chw-tc01') }),
    );
    expect(draft.ok && draft.invoice.entries[0]?.tasks[0]?.task_name).toBe('Outreach');
  });
});
