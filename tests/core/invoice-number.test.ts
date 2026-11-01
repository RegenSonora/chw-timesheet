import { describe, expect, it } from 'vitest';
import {
  formatInvoiceNumber,
  newCounter,
  normalizeInitials,
  setNextNumber,
  takeNumber,
} from '../../src/core/invoice-number';

describe('formatInvoiceNumber (SPEC §6)', () => {
  it('pads to three digits and grows past 999', () => {
    expect(formatInvoiceNumber('CC', 2026, 4)).toBe('CC-2026-004');
    expect(formatInvoiceNumber('CC', 2026, 999)).toBe('CC-2026-999');
    expect(formatInvoiceNumber('CC', 2026, 1000)).toBe('CC-2026-1000');
  });

  it('rejects bad parts', () => {
    expect(() => formatInvoiceNumber('cc', 2026, 1)).toThrow();
    expect(() => formatInvoiceNumber('CC', 26, 1)).toThrow();
    expect(() => formatInvoiceNumber('CC', 2026, 0)).toThrow();
  });
});

describe('normalizeInitials', () => {
  it('upper-cases and trims', () => {
    expect(normalizeInitials(' cc ')).toBe('CC');
    expect(normalizeInitials('MJRS')).toBe('MJRS');
  });

  it('refuses anything that would make a bad number', () => {
    for (const bad of ['', 'C C', 'C-C', 'ABCDE', 'C1', 'É']) {
      expect(normalizeInitials(bad), bad).toBeNull();
    }
  });
});

describe('shared counter (SPEC §6, decision 0005)', () => {
  it('starts at 1 and can be set at setup', () => {
    expect(newCounter()).toEqual({ next: 1, locked: false });
    expect(setNextNumber(newCounter(), 4)).toEqual({
      ok: true,
      counter: { next: 4, locked: false },
    });
  });

  it('refuses a starting number below 1 or not whole', () => {
    expect(setNextNumber(newCounter(), 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(setNextNumber(newCounter(), 2.5)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('locks after the first invoice and only moves forward', () => {
    const first = takeNumber({ next: 4, locked: false });
    expect(first).toEqual({ sequence: 4, counter: { next: 5, locked: true } });
    expect(setNextNumber(first.counter, 1)).toEqual({ ok: false, reason: 'locked' });
    expect(takeNumber(first.counter).sequence).toBe(5);
  });

  it('keeps counting across years and initials changes', () => {
    let counter = newCounter();
    const numbers: string[] = [];
    for (const [initials, year] of [
      ['CC', 2026],
      ['CC', 2027],
      ['CM', 2027],
    ] as const) {
      const taken = takeNumber(counter);
      counter = taken.counter;
      numbers.push(formatInvoiceNumber(initials, year, taken.sequence));
    }
    expect(numbers).toEqual(['CC-2026-001', 'CC-2027-002', 'CM-2027-003']);
  });
});
