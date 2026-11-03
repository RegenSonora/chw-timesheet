// Entry log CSV (SPEC §7, decisions 0001 and 0024): one header row and one row per task share of
// each entry, the same columns for every invoice so files combine. No per-entry dollar amount.
import { countValue } from '../../core/counts';
import { formatCentsPlain, formatQuarters } from '../../core/money';
import { rawSeconds } from '../../core/time';
import type { Invoice } from '../../core/types';
import { csvFile } from './csv';

export const ENTRY_LOG_COLUMNS = [
  'invoice_number',
  'fingerprint',
  'funding_source',
  'entry_id',
  'part',
  'entry_date',
  'start',
  'stop',
  'raw_duration',
  'billed_hours',
  'task',
  'core_competency',
  'budget_line',
  'rate',
  'contacts',
  'referrals_given',
  'referral_followups',
  'rides_provided',
  'applications_completed',
  'other_counts',
  'notes',
  'created_at',
  'updated_at',
] as const;

/** 5106 → "1:25:06": h:mm:ss before rounding. */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds));
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${String(Math.floor(s / 3600))}:${mm}:${ss}`;
}

/**
 * `billed_hours` is the row's task share, so the column adds up to the invoice hours. Times
 * repeat on every part; counts and notes are on part 1 only, so they add up too.
 */
export function entriesCsv(invoice: Invoice): Uint8Array<ArrayBuffer> {
  const rate = formatCentsPlain(invoice.rate_cents);
  const rows = invoice.entries.flatMap((e) =>
    e.tasks.map((t, i) => {
      const first = i === 0;
      const count = (n: number) => (first ? String(n) : '');
      return [
        invoice.number,
        invoice.fingerprint,
        invoice.source.code,
        e.id,
        `${String(i + 1)} of ${String(e.tasks.length)}`,
        e.entry_date,
        e.start,
        e.stop,
        durationText(rawSeconds(e.start, e.stop)),
        formatQuarters(t.quarters),
        t.task_name,
        t.core_competency ?? '',
        e.budget_line_name,
        rate,
        count(countValue(e.counts, 'contacts')),
        count(countValue(e.counts, 'referrals_given')),
        count(countValue(e.counts, 'referral_followups')),
        count(countValue(e.counts, 'rides_provided')),
        count(countValue(e.counts, 'applications_completed')),
        first ? e.counts.other.map((o) => `${o.label}=${String(o.value)}`).join('; ') : '',
        first ? e.notes : '',
        e.created_at,
        e.updated_at,
      ];
    }),
  );
  return csvFile([[...ENTRY_LOG_COLUMNS], ...rows]);
}
