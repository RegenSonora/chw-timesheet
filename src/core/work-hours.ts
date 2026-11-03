// Work Hours Report (decision 0026): invoiced hours per core competency, with the dates worked,
// laid out like the ADHS CHW hours attestation form. Pure: the form layout is passed in.
import type { Invoice } from './types';

/** A report form: its rows in order, and which competency names count toward each. */
export interface ReportForm {
  id: string;
  title: string;
  issuer: string;
  revised: string;
  /** Hours older than this many years don't count. */
  window_years: number;
  rows: { name: string; competencies: string[] }[];
}

export interface WorkHoursRow {
  name: string;
  quarters: number;
  /** YYYY-MM-DD, oldest first, each once. */
  dates: string[];
}

export interface WorkHoursReport {
  /** YYYY-MM-DD: the earliest date that counts, `window_years` before `made_on`. */
  window_start: string;
  /** YYYY-MM-DD: the day the report is made. */
  made_on: string;
  /** First and last dates worked in the window, or null with no hours. */
  first_date: string | null;
  last_date: string | null;
  /** In the form's order; rows with no hours are kept at 0. */
  rows: WorkHoursRow[];
  total_quarters: number;
  /** Hours whose competency the form doesn't list; counted in the total, shown apart. */
  other: WorkHoursRow;
  /** Invoice numbers with hours in the report, in sequence order. */
  invoice_numbers: string[];
}

/** "2026-11-02", 3 → "2023-11-02". A Feb 29 start becomes Feb 28. */
export function yearsBefore(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) - years;
  let rest = date.slice(4);
  if (rest === '-02-29' && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) {
    rest = '-02-28';
  }
  return `${String(year).padStart(4, '0')}${rest}`;
}

/**
 * The report over invoices from any of `sourceIds`: the selected source on a phone with no role,
 * every source of the person's role otherwise (decision 0032).
 */
export function workHoursReport(
  form: ReportForm,
  invoices: readonly Invoice[],
  sourceIds: readonly string[],
  madeOn: string,
): WorkHoursReport {
  const windowStart = yearsBefore(madeOn, form.window_years);
  const rowOf = new Map<string, number>();
  form.rows.forEach((row, i) => {
    for (const c of row.competencies) rowOf.set(c, i);
  });
  const sums = form.rows.map(() => ({ quarters: 0, dates: new Set<string>() }));
  const other = { quarters: 0, dates: new Set<string>() };
  const numbers: { sequence: number; number: string }[] = [];
  let first: string | null = null;
  let last: string | null = null;

  for (const invoice of invoices) {
    if (!sourceIds.includes(invoice.source.id)) continue;
    let used = false;
    for (const e of invoice.entries) {
      if (e.entry_date < windowStart || e.entry_date > madeOn) continue;
      for (const share of e.tasks) {
        const i = share.core_competency === null ? undefined : rowOf.get(share.core_competency);
        const sum = (i === undefined ? undefined : sums[i]) ?? other;
        sum.quarters += share.quarters;
        sum.dates.add(e.entry_date);
        used = true;
      }
      if (first === null || e.entry_date < first) first = e.entry_date;
      if (last === null || e.entry_date > last) last = e.entry_date;
    }
    if (used) numbers.push({ sequence: invoice.sequence, number: invoice.number });
  }

  const rows = form.rows.map((row, i) => {
    const sum = sums[i] ?? { quarters: 0, dates: new Set<string>() };
    return { name: row.name, quarters: sum.quarters, dates: [...sum.dates].sort() };
  });
  return {
    window_start: windowStart,
    made_on: madeOn,
    first_date: first,
    last_date: last,
    rows,
    total_quarters: rows.reduce((t, r) => t + r.quarters, other.quarters),
    other: { name: 'Other', quarters: other.quarters, dates: [...other.dates].sort() },
    invoice_numbers: numbers.sort((a, b) => a.sequence - b.sequence).map((n) => n.number),
  };
}
