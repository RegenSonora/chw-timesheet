// What screens show, in the phone's time zone (CLAUDE.md data conventions). Rules stay in src/core.
import { formatQuarters, parseIso } from '../core';

/** Tests pass a zone; the app leaves it out to use the phone's. */
type Zone = string | undefined;

const zoned = (zone: Zone): { timeZone?: string } => (zone === undefined ? {} : { timeZone: zone });

/** 6 → "1.5 h", 7 → "1.75 h", 8 → "2 h" (wireframes). */
export function hoursLabel(quarters: number): string {
  return `${formatQuarters(quarters).replace(/\.?0+$/, '')} h`;
}

/** "2026-10-30" → "Fri, Oct 30". */
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** "2026-10-29" → "Oct 29". */
export function shortDateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function clockParts(iso: string, zone: Zone): { time: string; period: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...zoned(zone),
  }).formatToParts(new Date(parseIso(iso).epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return { time: `${get('hour') ?? ''}:${get('minute') ?? ''}`, period: get('dayPeriod') ?? '' };
}

/** "9:12 AM". */
export function timeLabel(iso: string, zone?: Zone): string {
  const { time, period } = clockParts(iso, zone);
  return `${time} ${period}`;
}

/** "9:12–10:37 AM", "11:30 AM–1:00 PM", "11:00 PM–1:00 AM (next day)". */
export function timeRangeLabel(start: string, stop: string, zone?: Zone): string {
  const a = clockParts(start, zone);
  const b = clockParts(stop, zone);
  const range =
    a.period === b.period
      ? `${a.time}–${b.time} ${b.period}`
      : `${a.time} ${a.period}–${b.time} ${b.period}`;
  return localDateTime(start, zone).date === localDateTime(stop, zone).date
    ? range
    : `${range} (next day)`;
}

/** 5106 s → "1 h 25 min"; 1500 → "25 min"; 7200 → "2 h". Whole minutes, rounded down. */
export function durationLabel(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${String(m)} min`;
  return m === 0 ? `${String(h)} h` : `${String(h)} h ${String(m)} min`;
}

/** Elapsed timer clock: 5047 s → "1:24:07". */
export function clockLabel(seconds: number): string {
  const s = Math.floor(Math.max(0, seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** The local date and HH:MM of a timestamp, for prefilling "Enter times" fields. */
export function localDateTime(iso: string, zone?: Zone): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...zoned(zone),
  }).formatToParts(new Date(parseIso(iso).epochMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

/** "1 entry", "8 entries". */
export function plural(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}
