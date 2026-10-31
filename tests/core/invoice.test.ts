import { describe, expect, it } from 'vitest';
import { sumCounts } from '../../src/core/counts';
import { buildInvoiceDraft, createInvoice, uninvoicedEntries } from '../../src/core/invoice';
import type { InvoiceInput } from '../../src/core/invoice';
import { verifyFingerprint } from '../../src/core/fingerprint';
import {
  counts,
  makeEntry,
  must,
  priorInvoice,
  regen,
  sampleEntries,
  sampleInput,
  tisupp,
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
      task_name: 'Client check in',
      core_competency: 'Interpersonal & Relationship-Building',
      budget_line_name: 'CHW referrals',
    });
  });

  it('snapshots the source, CHW and certification', () => {
    expect(invoice.source).toEqual({
      id: 'tisupp',
      code: 'TISUPP',
      name: 'Trauma-Informed Substance Use Prevention Program',
      version: 1,
      certification_text: tisupp.certification_text,
    });
    expect(invoice.chw).toEqual({ name: 'Carmen Cruz', initials: 'CC', mailing_address: '' });
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
        profile: { name: 'Carmen Cruz', initials: 'CM', mailing_address: '', logo: null },
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
    expect(invoice.counts_all_time.contacts).toBe(6);
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
