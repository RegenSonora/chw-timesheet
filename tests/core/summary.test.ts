import { describe, expect, it } from 'vitest';
import { buildInvoiceDraft } from '../../src/core/invoice';
import { uninvoicedSummary } from '../../src/core/summary';
import { makeEntry, sampleEntries, sampleInput, uuid } from './fixtures/wireframe-sample';

describe('uninvoicedSummary (SPEC §5 Home)', () => {
  it('matches the wireframe: 8 entries · 9.25 h · $185.00', () => {
    expect(uninvoicedSummary(sampleEntries, 'tisupp', 2000)).toEqual({
      count: 8,
      quarters: 37,
      amount_cents: 18_500,
    });
  });

  it('always equals the invoice the Generate button would create', () => {
    for (const rate of [2000, 2237, 1999, 1]) {
      const input = sampleInput({
        settings: { source_id: 'tisupp', rate_cents: rate, nte_cents: null },
      });
      const draft = buildInvoiceDraft(input);
      if (!draft.ok) throw new Error(draft.reason);
      const summary = uninvoicedSummary(input.entries, 'tisupp', rate);
      expect(summary.amount_cents).toBe(draft.invoice.total_cents);
      expect(summary.quarters).toBe(draft.invoice.total_quarters);
    }
  });

  it('rounds once per budget line, not per entry', () => {
    // Two 0.25 h entries on one line at $22.37: 2 × 2237 ÷ 4 = 1118.5 → $11.19,
    // where rounding each entry (559.25 → 559) would give $11.18.
    const entries = [
      makeEntry('2026-10-20', '09:00:00', '09:15:00', 'outreach', 'chw-referrals'),
      makeEntry('2026-10-20', '10:00:00', '10:15:00', 'outreach', 'chw-referrals'),
    ];
    expect(uninvoicedSummary(entries, 'tisupp', 2237).amount_cents).toBe(1119);
  });

  it('leaves out invoiced entries and other sources', () => {
    const entries = [
      makeEntry('2026-10-20', '09:00:00', '10:00:00', 'outreach', 'chw-referrals'),
      makeEntry('2026-10-21', '09:00:00', '10:00:00', 'outreach', 'chw-referrals', {
        invoice_id: uuid(1),
      }),
      makeEntry('2026-10-22', '09:00:00', '10:00:00', 'outreach', 'chw-referrals', {
        source_id: 'regen-general-operating',
      }),
    ];
    expect(uninvoicedSummary(entries, 'tisupp', 2000)).toEqual({
      count: 1,
      quarters: 4,
      amount_cents: 2000,
    });
  });

  it('is zero with nothing waiting, and with no rate yet', () => {
    expect(uninvoicedSummary([], 'tisupp', 2000)).toEqual({
      count: 0,
      quarters: 0,
      amount_cents: 0,
    });
    expect(uninvoicedSummary(sampleEntries, 'tisupp', null)).toEqual({
      count: 8,
      quarters: 37,
      amount_cents: null,
    });
  });
});
