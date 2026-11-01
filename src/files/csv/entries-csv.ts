// Entry log CSV (SPEC §7, decision 0001): one header row and one row per entry, the same
// columns for every invoice so files combine. No per-entry dollar amount.
import { formatCentsPlain, formatQuarters } from '../../core/money';
import { rawSeconds } from '../../core/time';
import type { Invoice } from '../../core/types';
import { csvFile } from './csv';

export const ENTRY_LOG_COLUMNS = [
  'invoice_number',
  'fingerprint',
  'funding_source',
  'entry_id',
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

export function entriesCsv(invoice: Invoice): Uint8Array<ArrayBuffer> {
  const rate = formatCentsPlain(invoice.rate_cents);
  const rows = invoice.entries.map((e) => [
    invoice.number,
    invoice.fingerprint,
    invoice.source.code,
    e.id,
    e.entry_date,
    e.start,
    e.stop,
    durationText(rawSeconds(e.start, e.stop)),
    formatQuarters(e.quarters),
    e.task_name,
    e.core_competency ?? '',
    e.budget_line_name,
    rate,
    String(e.counts.contacts),
    String(e.counts.referrals_given),
    String(e.counts.referral_followups),
    String(e.counts.rides_provided),
    String(e.counts.applications_completed),
    e.counts.other.map((o) => `${o.label}=${String(o.value)}`).join('; '),
    e.notes,
    e.created_at,
    e.updated_at,
  ]);
  return csvFile([[...ENTRY_LOG_COLUMNS], ...rows]);
}
