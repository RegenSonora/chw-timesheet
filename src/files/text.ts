// Labels printed in the files. No Intl and no clock: the same invoice always gives the same
// bytes, on any phone, so a re-shared file matches the first one.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(date: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** 2026-10-31 → "Oct 31, 2026" */
export function longDate(date: string): string {
  const { y, m, d } = parts(date);
  return `${MONTHS[m - 1] ?? ''} ${String(d)}, ${String(y)}`;
}

/** "Oct 20 – Oct 30, 2026"; the year is repeated only when it changes. */
export function dateRange(first: string, last: string): string {
  if (first === last) return longDate(first);
  const a = parts(first);
  const b = parts(last);
  const start = `${MONTHS[a.m - 1] ?? ''} ${String(a.d)}`;
  return a.y === b.y ? `${start} – ${longDate(last)}` : `${longDate(first)} – ${longDate(last)}`;
}

/** 2026-10-20 → "Tue" */
export function weekday(date: string): string {
  const { y, m, d } = parts(date);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
}

/** 2026-10-20 → "10/20" */
export function monthDay(date: string): string {
  const { m, d } = parts(date);
  return `${String(m)}/${String(d)}`;
}
