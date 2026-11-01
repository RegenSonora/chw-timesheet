// Time rules (SPEC §5): ISO timestamps with offset, quarter-hour rounding, hand-entered times.

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^(\d{2}):(\d{2})$/;
const MAX_OFFSET_MINUTES = 14 * 60;
const SECONDS_PER_QUARTER = 900;

/** Offset east of UTC in minutes for an instant, e.g. -420 in Arizona. Note: the opposite sign of Date#getTimezoneOffset. */
export type OffsetAt = (epochMs: number) => number;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Format an instant as ISO 8601 with offset, truncated to whole seconds: 2026-10-30T09:12:04-07:00. */
export function toIsoWithOffset(epochMs: number, offsetMinutes: number): string {
  if (!Number.isFinite(epochMs)) throw new RangeError('epochMs must be finite');
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES) {
    throw new RangeError(`Bad offset: ${String(offsetMinutes)}`);
  }
  const local = new Date(Math.floor(epochMs / 1000) * 1000 + offsetMinutes * 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Parse a timestamp written by toIsoWithOffset. Throws on anything else. */
export function parseIso(iso: string): { epochMs: number; offsetMinutes: number } {
  const m = ISO.exec(iso);
  if (!m) throw new RangeError(`Not an ISO timestamp with offset: ${iso}`);
  const n = (i: number) => Number(m[i]);
  const offsetMinutes = (m[7] === '-' ? -1 : 1) * (n(8) * 60 + n(9));
  const epochMs = Date.UTC(n(1), n(2) - 1, n(3), n(4), n(5), n(6)) - offsetMinutes * 60_000;
  // Reject impossible dates and times (Feb 30, 25:00) and "-00:00" by round-tripping.
  if (
    Math.abs(offsetMinutes) > MAX_OFFSET_MINUTES ||
    toIsoWithOffset(epochMs, offsetMinutes) !== iso
  ) {
    throw new RangeError(`Not a valid timestamp: ${iso}`);
  }
  return { epochMs, offsetMinutes };
}

/** An entry belongs to its start's local date (SPEC §5), even when it crosses midnight. */
export function entryDateOf(startIso: string): string {
  parseIso(startIso);
  return startIso.slice(0, 10);
}

/** Whole seconds between two timestamps. Negative when stop is before start. */
export function rawSeconds(startIso: string, stopIso: string): number {
  return (parseIso(stopIso).epochMs - parseIso(startIso).epochMs) / 1000;
}

/** Round raw seconds to the nearest quarter-hour, halves up: 449 s → 0, 450 s → 1 (SPEC §5). */
export function roundToQuarters(seconds: number): number {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new RangeError(`Seconds must be a non-negative integer: ${String(seconds)}`);
  }
  return Math.floor((seconds + SECONDS_PER_QUARTER / 2) / SECONDS_PER_QUARTER);
}

export type EntryTimesCheck =
  | { ok: true; seconds: number; quarters: number }
  | { ok: false; reason: 'stop_before_start' | 'too_short' };

/** Can these raw times be saved? An entry that rounds to 0 h is never saved (SPEC §5 "Too short"). */
export function checkEntryTimes(startIso: string, stopIso: string): EntryTimesCheck {
  const seconds = rawSeconds(startIso, stopIso);
  if (seconds < 0) return { ok: false, reason: 'stop_before_start' };
  const quarters = roundToQuarters(seconds);
  if (quarters === 0) return { ok: false, reason: 'too_short' };
  return { ok: true, seconds, quarters };
}

function localToEpoch(localMs: number, offsetAt: OffsetAt): number {
  // Two passes so a time near a daylight-saving change uses the offset in effect at that time.
  const guess = localMs - offsetAt(localMs) * 60_000;
  return localMs - offsetAt(guess) * 60_000;
}

/**
 * Turn "Enter times" input into raw timestamps. An end earlier than the start
 * means the next day (SPEC §5). An end equal to the start is 0 h (too short).
 */
export function resolveHandTimes(
  date: string,
  start: string,
  end: string,
  offsetAt: OffsetAt,
): { start: string; stop: string; next_day: boolean } {
  const dm = DATE.exec(date);
  const sm = CLOCK.exec(start);
  const em = CLOCK.exec(end);
  if (!dm || !sm || !em) throw new RangeError('Expected YYYY-MM-DD and HH:MM');
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const minutes = (m: RegExpExecArray) => {
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) throw new RangeError(`Not a time: ${m[0]}`);
    return h * 60 + mi;
  };
  const startMin = minutes(sm);
  const endMin = minutes(em);
  const day = Date.UTC(y, mo - 1, d);
  if (new Date(day).toISOString().slice(0, 10) !== date)
    throw new RangeError(`Not a date: ${date}`);
  const nextDay = endMin < startMin;
  const startMs = localToEpoch(day + startMin * 60_000, offsetAt);
  const stopMs = localToEpoch(day + (nextDay ? 1440 : 0) * 60_000 + endMin * 60_000, offsetAt);
  return {
    start: toIsoWithOffset(startMs, offsetAt(startMs)),
    stop: toIsoWithOffset(stopMs, offsetAt(stopMs)),
    next_day: nextDay,
  };
}
