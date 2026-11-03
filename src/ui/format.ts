// What screens show, in the phone's time zone (CLAUDE.md data conventions). Rules stay in src/core.
import {
  formatDollars,
  formatQuarters,
  parseIso,
  type BudgetLine,
  type FundingSourceConfig,
  type RateStepReminder,
  type Role,
  type TaskShare,
} from '../core';

/** Tests pass a zone; the app leaves it out to use the phone's. */
type Zone = string | undefined;

const zoned = (zone: Zone): { timeZone?: string } => (zone === undefined ? {} : { timeZone: zone });

/** "hr" for exactly one hour, else "hrs" (decision 0026). */
export const hrs = (hours: number): string => (hours === 1 ? 'hr' : 'hrs');

/** 6 → "1.5 hrs", 4 → "1 hr", 8 → "2 hrs" (decision 0026). */
export function hoursLabel(quarters: number): string {
  return `${formatQuarters(quarters).replace(/\.?0+$/, '')} ${hrs(quarters / 4)}`;
}

/** A budget line as the app shows it; `name` still prints on the files (decision 0028). */
export function lineName(line: Pick<BudgetLine, 'name' | 'display_name'>): string {
  return line.display_name ?? line.name;
}

/** "CHW-TC01 · CHW Trainee (Contractor)" (decision 0027). */
export function roleLabel(role: Pick<Role, 'code' | 'name'>): string {
  return `${role.code} · ${role.name}`;
}

/** What the person makes from their hours: employees submit timesheets (decision 0031). */
export function paperWord(role: Pick<Role, 'employment'> | null): 'invoice' | 'timesheet' {
  return role?.employment === 'employee' ? 'timesheet' : 'invoice';
}

/** The raise reminder's words with a role: no source named, invoice or timesheet (decision 0030). */
export function roleRaiseText(reminder: RateStepReminder, employee: boolean): string {
  const hours = `${String(reminder.after_quarters / 4)} hours`;
  const rate = formatDollars(reminder.rate_cents);
  if (reminder.invoice_first) {
    const now = employee ? 'Submit your timesheet now' : 'Generate your invoice now';
    return `You've reached ${hours}. ${now}, then change your rate to ${rate} in Settings.`;
  }
  return employee
    ? `You've submitted ${hours}. Your rate is now ${rate}. Change it in Settings before your next timesheet.`
    : `You've invoiced ${hours}. Your rate is now ${rate}. Change it in Settings before your next invoice.`;
}

/** "TISUPP · CHW experience hours": the steps with one option, shown as a label (decision 0028). */
export function billedToLabel(source: string | null, line: string | null): string | null {
  const parts = [source, line].filter((p): p is string => p !== null);
  return parts.length ? parts.join(' · ') : null;
}

/** "Outreach", or "Outreach + 2 more" for a split entry (decision 0024). */
export function tasksLabel(
  source: Pick<FundingSourceConfig, 'tasks'>,
  shares: readonly TaskShare[],
): string {
  const [first, ...rest] = shares;
  const name = source.tasks.find((t) => t.id === first?.task_id)?.name ?? 'Task';
  return rest.length ? `${name} + ${String(rest.length)} more` : name;
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
  return m === 0 ? `${String(h)} ${hrs(h)}` : `${String(h)} ${hrs(h)} ${String(m)} min`;
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

/** "0.9.0 (a1b2c3d)" from the build's "0.9.0+a1b2c3d" (decision 0016). */
export function versionLabel(version: string): string {
  const [release, commit] = version.split('+');
  return commit ? `${release ?? ''} (${commit})` : version;
}
