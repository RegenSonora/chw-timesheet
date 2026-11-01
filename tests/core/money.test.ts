import { describe, expect, it } from 'vitest';
import {
  formatCentsPlain,
  formatDollars,
  formatQuarters,
  lineAmountCents,
  parseDollars,
  sumCents,
} from '../../src/core/money';

describe('lineAmountCents (SPEC §6)', () => {
  it('bills an odd rate of $22.37 half up', () => {
    // 2237 / 4 = 559.25 → 559; 4474 / 4 = 1118.5 → 1119; 6711 / 4 = 1677.75 → 1678
    expect(lineAmountCents(1, 2237)).toBe(559);
    expect(lineAmountCents(2, 2237)).toBe(1119);
    expect(lineAmountCents(3, 2237)).toBe(1678);
    expect(lineAmountCents(4, 2237)).toBe(2237);
  });

  it('matches a BigInt half-up reference over many rates and hours', () => {
    for (let rate = 1; rate <= 5000; rate += 7) {
      for (let q = 0; q <= 400; q += 13) {
        const expected = Number((BigInt(q) * BigInt(rate) * 2n + 4n) / 8n);
        if (lineAmountCents(q, rate) !== expected) {
          throw new Error(`mismatch at q=${String(q)} rate=${String(rate)}`);
        }
      }
    }
  });

  it('is exact for whole-dollar rates', () => {
    expect(lineAmountCents(37, 2000)).toBe(18_500);
    expect(lineAmountCents(0, 2000)).toBe(0);
  });

  it('rejects floats, negatives and amounts past safe integers', () => {
    expect(() => lineAmountCents(1.5, 2000)).toThrow();
    expect(() => lineAmountCents(-1, 2000)).toThrow();
    expect(() => lineAmountCents(1, 20.5)).toThrow();
    expect(() => lineAmountCents(2 ** 30, 2 ** 30)).toThrow();
  });

  it('makes the total the sum of rounded lines, not the rounded sum', () => {
    // Two lines of 1 quarter at $22.37: 559 + 559 = 1118, while 2 quarters on one line is 1119.
    expect(sumCents([lineAmountCents(1, 2237), lineAmountCents(1, 2237)])).toBe(1118);
  });
});

describe('sumCents', () => {
  it('rejects non-integers and overflow', () => {
    expect(() => sumCents([1, 0.5])).toThrow();
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(sumCents([])).toBe(0);
  });
});

describe('parseDollars', () => {
  it('reads typed amounts', () => {
    expect(parseDollars('$22.37')).toBe(2237);
    expect(parseDollars('20')).toBe(2000);
    expect(parseDollars('20.5')).toBe(2050);
    expect(parseDollars(' $5,000.00 ')).toBe(500_000);
    expect(parseDollars('5000')).toBe(500_000);
    expect(parseDollars('0.07')).toBe(7);
  });

  it('refuses anything else', () => {
    for (const bad of ['', '$', '-20', '20.555', '2,00', '20.', '.5', 'abc', '1e3', '20,00.00']) {
      expect(parseDollars(bad), bad).toBeNull();
    }
  });
});

describe('formatting', () => {
  it('formats cents for CSV and display', () => {
    expect(formatCentsPlain(2000)).toBe('20.00');
    expect(formatCentsPlain(7)).toBe('0.07');
    expect(formatCentsPlain(-6500)).toBe('-65.00');
    expect(formatDollars(500_000)).toBe('$5,000.00');
    expect(formatDollars(-6500)).toBe('-$65.00');
    expect(formatDollars(123_456_789)).toBe('$1,234,567.89');
  });

  it('formats quarter-hours with two decimals', () => {
    expect([0, 1, 2, 3, 4, 37].map(formatQuarters)).toEqual([
      '0.00',
      '0.25',
      '0.50',
      '0.75',
      '1.00',
      '9.25',
    ]);
  });
});
