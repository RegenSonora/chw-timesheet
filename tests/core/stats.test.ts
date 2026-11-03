// My stats on Home (decision 0026).
import { describe, expect, it } from 'vitest';
import { invoicedQuarters, sourceMyStats } from '../../src/core/stats';
import type { FundingSourceConfig } from '../../src/core/types';
import { counts, priorInvoice, regen, tisupp } from './fixtures/wireframe-sample';

const source: FundingSourceConfig = {
  ...tisupp,
  rate_step: { after_quarters: 960, rate_cents: 2300 },
  certification_step: { after_quarters: 1920, name: 'CHW Cert' },
};

/** A TISUPP invoice of `hours` hours (priorInvoice takes cents at $20/h). */
const billed = (n: number, hours: number, from = source) =>
  priorInvoice(n, hours * 2000, counts(), from);

describe('invoicedQuarters', () => {
  it("adds this source's invoices and ignores other sources", () => {
    expect(invoicedQuarters(source, [])).toBe(0);
    expect(invoicedQuarters(source, [billed(1, 10), billed(2, 2.5), billed(3, 99, regen)])).toBe(
      50,
    );
  });
});

describe('sourceMyStats', () => {
  it('with no invoices: 0 invoiced, the full 240 and 480 hours to go', () => {
    expect(sourceMyStats(source, 2000, [], 0)).toEqual({
      invoiced_quarters: 0,
      waiting_quarters: 0,
      pay: { state: 'counting', left_quarters: 960, after_quarters: 960, rate_cents: 2300 },
      certification: {
        state: 'counting',
        left_quarters: 1920,
        after_quarters: 1920,
        name: 'CHW Cert',
      },
    });
  });

  it('waiting hours are shown but do not move the goals', () => {
    const stats = sourceMyStats(source, 2000, [billed(1, 152.5)], 18);
    expect(stats.invoiced_quarters).toBe(610);
    expect(stats.waiting_quarters).toBe(18);
    expect(stats.pay).toMatchObject({ state: 'counting', left_quarters: 350 });
    expect(stats.certification).toMatchObject({ state: 'counting', left_quarters: 1310 });
  });

  it('at exactly 240 hours with the rate still lower, the raise is reached', () => {
    expect(sourceMyStats(source, 2000, [billed(1, 240)], 0).pay).toEqual({
      state: 'reached',
      after_quarters: 960,
      rate_cents: 2300,
    });
  });

  it('the pay row goes once 240 hours are invoiced and the rate is at least the new rate', () => {
    expect(sourceMyStats(source, 2300, [billed(1, 240)], 0).pay).toBeNull();
    expect(sourceMyStats(source, 2500, [billed(1, 300)], 0).pay).toBeNull();
  });

  it('a rate raised early keeps the countdown until 240 hours', () => {
    expect(sourceMyStats(source, 2300, [billed(1, 100)], 0).pay).toMatchObject({
      state: 'counting',
      left_quarters: 560,
    });
  });

  it('with no rate yet, the pay row still counts down', () => {
    expect(sourceMyStats(source, null, [], 0).pay).toMatchObject({ state: 'counting' });
  });

  it('at and past 480 hours the CHW is eligible for certification', () => {
    for (const hours of [480, 486.5]) {
      expect(sourceMyStats(source, 2300, [billed(1, hours)], 0).certification).toEqual({
        state: 'eligible',
        after_quarters: 1920,
        name: 'CHW Cert',
      });
    }
  });

  it('a source with no steps has no pay or certification rows', () => {
    const plain: FundingSourceConfig = { ...tisupp };
    delete plain.rate_step;
    delete plain.certification_step;
    expect(sourceMyStats(plain, 2000, [billed(1, 10, plain)], 4)).toEqual({
      invoiced_quarters: 40,
      waiting_quarters: 4,
      pay: null,
      certification: null,
    });
  });
});
