import { describe, expect, it } from 'vitest';
import { rateChangeCheck, rateStepReminder } from '../../src/core/rate-change';
import type { FundingSourceConfig, Invoice } from '../../src/core/types';
import { counts, priorInvoice, regen, tisupp } from './fixtures/wireframe-sample';

describe('rateChangeCheck (SPEC §4)', () => {
  it('asks when uninvoiced entries would be billed at the new rate', () => {
    expect(rateChangeCheck(2000, 2200, 8)).toEqual({
      kind: 'confirm',
      count: 8,
      old_rate_cents: 2000,
      new_rate_cents: 2200,
    });
  });

  it('asks for a lower rate too', () => {
    expect(rateChangeCheck(2200, 2000, 1).kind).toBe('confirm');
  });

  it('applies without asking when nothing is waiting', () => {
    expect(rateChangeCheck(2000, 2200, 0)).toEqual({ kind: 'apply' });
    expect(rateChangeCheck(null, 2200, 3)).toEqual({ kind: 'apply' });
  });

  it('does nothing when the rate is unchanged', () => {
    expect(rateChangeCheck(2000, 2000, 8)).toEqual({ kind: 'no_change' });
  });

  it('rejects a bad new rate or count', () => {
    expect(() => rateChangeCheck(2000, 0, 1)).toThrow();
    expect(() => rateChangeCheck(2000, 22.5, 1)).toThrow();
    expect(() => rateChangeCheck(2000, 2200, -1)).toThrow();
  });
});

describe('rateStepReminder (decision 0023)', () => {
  const step = { after_quarters: 960, rate_cents: 2300 };
  const gila: FundingSourceConfig = { ...tisupp, rate_step: step };
  /** Earlier invoices for a source, each billing these hours. */
  const billed = (hours: number[], source = gila): Invoice[] =>
    hours.map((h, i) => ({
      ...priorInvoice(i + 1, h * 2000, counts(), source),
      total_quarters: h * 4,
    }));

  it('says nothing for a source without a rate step', () => {
    expect(rateStepReminder(regen, 2000, billed([300], regen), 0)).toBeNull();
  });

  it('says nothing under 240 hours', () => {
    expect(rateStepReminder(gila, 2000, billed([100, 100]), 39 * 4 + 3)).toBeNull();
  });

  it('asks to invoice first, then raise, when the waiting hours reach 240', () => {
    expect(rateStepReminder(gila, 2000, billed([100, 100]), 40 * 4)).toEqual({
      invoice_first: true,
      after_quarters: 960,
      rate_cents: 2300,
    });
    expect(rateStepReminder(gila, 2000, billed([200]), 60 * 4)?.invoice_first).toBe(true);
  });

  it('asks only to raise once 240 hours are invoiced', () => {
    expect(rateStepReminder(gila, 2000, billed([120, 120]), 0)).toEqual({
      invoice_first: false,
      after_quarters: 960,
      rate_cents: 2300,
    });
    expect(rateStepReminder(gila, 2000, billed([250]), 8)?.invoice_first).toBe(false);
  });

  it('stops once the rate is at or above the new rate', () => {
    expect(rateStepReminder(gila, 2300, billed([250]), 8)).toBeNull();
    expect(rateStepReminder(gila, 2500, billed([250]), 8)).toBeNull();
  });

  it('counts only this source and no rate yet means no reminder', () => {
    expect(rateStepReminder(gila, 2000, billed([300], regen), 0)).toBeNull();
    expect(rateStepReminder(gila, null, billed([300]), 0)).toBeNull();
  });
});
