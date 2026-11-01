import { describe, expect, it } from 'vitest';
import {
  checkEntryTimes,
  entryDateOf,
  parseIso,
  rawSeconds,
  resolveHandTimes,
  roundToQuarters,
  toIsoWithOffset,
} from '../../src/core/time';

const arizona = () => -420;

describe('roundToQuarters (SPEC §5)', () => {
  it('matches a BigInt reference for every second of a day', () => {
    for (let s = 0; s <= 86_400; s++) {
      // Nearest quarter-hour, halves up: floor((2s + 900) / 1800).
      const expected = Number((2n * BigInt(s) + 900n) / 1800n);
      if (roundToQuarters(s) !== expected) throw new Error(`mismatch at ${String(s)}`);
    }
  });

  it('rounds the 7.5-minute boundaries half up', () => {
    expect(roundToQuarters(0)).toBe(0);
    expect(roundToQuarters(449)).toBe(0);
    expect(roundToQuarters(450)).toBe(1);
    expect(roundToQuarters(1349)).toBe(1);
    expect(roundToQuarters(1350)).toBe(2);
    expect(roundToQuarters(900)).toBe(1);
  });

  it('rounds 1:25:06 to 1.50 h', () => {
    expect(roundToQuarters(5106)).toBe(6);
  });

  it('rejects negative, fractional and unsafe input', () => {
    expect(() => roundToQuarters(-1)).toThrow();
    expect(() => roundToQuarters(1.5)).toThrow();
    expect(() => roundToQuarters(Number.NaN)).toThrow();
    expect(() => roundToQuarters(2 ** 53)).toThrow();
  });
});

describe('ISO timestamps with offset', () => {
  it('formats in the given offset and truncates to whole seconds', () => {
    const ms = Date.UTC(2026, 9, 30, 16, 12, 4, 999);
    expect(toIsoWithOffset(ms, -420)).toBe('2026-10-30T09:12:04-07:00');
    expect(toIsoWithOffset(ms, 0)).toBe('2026-10-30T16:12:04+00:00');
    expect(toIsoWithOffset(ms, 330)).toBe('2026-10-30T21:42:04+05:30');
  });

  it('round-trips through parseIso', () => {
    const iso = '2026-12-31T23:59:59-07:00';
    const { epochMs, offsetMinutes } = parseIso(iso);
    expect(offsetMinutes).toBe(-420);
    expect(toIsoWithOffset(epochMs, offsetMinutes)).toBe(iso);
  });

  it('rejects other shapes and impossible values', () => {
    for (const bad of [
      '2026-10-30T09:12:04Z',
      '2026-10-30T09:12:04.000-07:00',
      '2026-10-30T09:12-07:00',
      '2026-02-30T09:00:00-07:00',
      '2026-10-30T24:00:00-07:00',
      '2026-10-30T09:00:00-00:00',
      '2026-10-30T09:00:00+15:00',
      '2026-10-30',
    ]) {
      expect(() => parseIso(bad), bad).toThrow();
    }
  });

  it('rejects bad offsets when formatting', () => {
    expect(() => toIsoWithOffset(0, 1.5)).toThrow();
    expect(() => toIsoWithOffset(0, 15 * 60)).toThrow();
  });
});

describe('entry date (SPEC §5)', () => {
  it('is the local start date, also across midnight and New Year', () => {
    expect(entryDateOf('2026-10-30T23:30:00-07:00')).toBe('2026-10-30');
    expect(entryDateOf('2026-12-31T23:50:00-07:00')).toBe('2026-12-31');
  });

  it('uses the recorded offset, not UTC', () => {
    // 23:30 in Arizona is already the next day in UTC.
    expect(entryDateOf('2026-10-30T23:30:00-07:00')).not.toBe('2026-10-31');
  });
});

describe('checkEntryTimes', () => {
  it('blocks an entry that rounds to 0 h', () => {
    expect(checkEntryTimes('2026-10-30T09:00:00-07:00', '2026-10-30T09:07:29-07:00')).toEqual({
      ok: false,
      reason: 'too_short',
    });
    expect(checkEntryTimes('2026-10-30T09:00:00-07:00', '2026-10-30T09:00:00-07:00')).toEqual({
      ok: false,
      reason: 'too_short',
    });
  });

  it('accepts exactly 7.5 minutes as 0.25 h', () => {
    expect(checkEntryTimes('2026-10-30T09:00:00-07:00', '2026-10-30T09:07:30-07:00')).toEqual({
      ok: true,
      seconds: 450,
      quarters: 1,
    });
  });

  it('rejects a stop before the start', () => {
    expect(checkEntryTimes('2026-10-30T09:00:00-07:00', '2026-10-30T08:59:59-07:00')).toEqual({
      ok: false,
      reason: 'stop_before_start',
    });
  });

  it('compares instants, not wall-clock text, across offsets', () => {
    expect(rawSeconds('2026-10-30T09:00:00-07:00', '2026-10-30T16:15:00+00:00')).toBe(900);
  });
});

describe('resolveHandTimes (SPEC §5 Enter times)', () => {
  it('keeps a same-day entry on its date', () => {
    expect(resolveHandTimes('2026-10-29', '13:15', '15:00', arizona)).toEqual({
      start: '2026-10-29T13:15:00-07:00',
      stop: '2026-10-29T15:00:00-07:00',
      next_day: false,
    });
  });

  it('treats an end earlier than the start as the next day', () => {
    expect(resolveHandTimes('2026-10-30', '22:00', '01:30', arizona)).toEqual({
      start: '2026-10-30T22:00:00-07:00',
      stop: '2026-10-31T01:30:00-07:00',
      next_day: true,
    });
  });

  it('crosses month and year ends', () => {
    expect(resolveHandTimes('2026-12-31', '23:00', '00:15', arizona).stop).toBe(
      '2027-01-01T00:15:00-07:00',
    );
    expect(resolveHandTimes('2028-02-28', '23:00', '00:15', arizona).stop).toBe(
      '2028-02-29T00:15:00-07:00',
    );
  });

  it('keeps an equal end on the same day (0 h, blocked later as too short)', () => {
    const r = resolveHandTimes('2026-10-30', '09:00', '09:00', arizona);
    expect(r.next_day).toBe(false);
    expect(checkEntryTimes(r.start, r.stop)).toEqual({ ok: false, reason: 'too_short' });
  });

  it('uses the offset in effect at each end (daylight saving elsewhere)', () => {
    // A zone at -06:00 before 2026-11-01T08:00Z and -07:00 after.
    const change = Date.UTC(2026, 10, 1, 8);
    const offsetAt = (ms: number) => (ms < change ? -360 : -420);
    const r = resolveHandTimes('2026-10-31', '23:00', '03:00', offsetAt);
    expect(r.start).toBe('2026-10-31T23:00:00-06:00');
    expect(r.stop).toBe('2026-11-01T03:00:00-07:00');
    expect(rawSeconds(r.start, r.stop)).toBe(5 * 3600);
  });

  it('rejects malformed input', () => {
    expect(() => resolveHandTimes('2026-02-30', '09:00', '10:00', arizona)).toThrow();
    expect(() => resolveHandTimes('2026-10-30', '24:00', '10:00', arizona)).toThrow();
    expect(() => resolveHandTimes('2026-10-30', '9:00', '10:00', arizona)).toThrow();
    expect(() => resolveHandTimes('2026-10-30', '09:60', '10:00', arizona)).toThrow();
  });
});
