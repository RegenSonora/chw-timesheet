import { describe, expect, it } from 'vitest';
import { rateChangeCheck } from '../../src/core/rate-change';

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
