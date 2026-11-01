// Invoice fingerprint (SPEC §7, CLAUDE.md rule 8): SHA-256 over a versioned canonical form.
// Never change canonicalFormV1. A new form gets a new version and v1 invoices keep verifying.
import { canonicalJson } from './canonical';
import type { Invoice } from './types';

export const CANONICAL_VERSION = 1;

/** The fields an invoice is fingerprinted over: header, entries, lines, totals and rate. */
export type FingerprintedInvoice = Omit<Invoice, 'fingerprint'>;

/**
 * Canonical form v1. Leaves out what depends on other invoices (NTE tracker, all-time
 * counts), what is derived from the entries (period counts) and record timestamps.
 */
export function canonicalFormV1(invoice: FingerprintedInvoice): string {
  return canonicalJson({
    v: 1,
    id: invoice.id,
    number: invoice.number,
    sequence: invoice.sequence,
    invoice_date: invoice.invoice_date,
    period_start: invoice.period_start,
    period_end: invoice.period_end,
    source: {
      id: invoice.source.id,
      code: invoice.source.code,
      name: invoice.source.name,
      version: invoice.source.version,
    },
    chw: {
      name: invoice.chw.name,
      initials: invoice.chw.initials,
      mailing_address: invoice.chw.mailing_address,
    },
    rate_cents: invoice.rate_cents,
    entries: invoice.entries.map((e) => ({
      id: e.id,
      start: e.start,
      stop: e.stop,
      entry_date: e.entry_date,
      quarters: e.quarters,
      task_id: e.task_id,
      task_name: e.task_name,
      core_competency: e.core_competency,
      budget_line_id: e.budget_line_id,
      budget_line_name: e.budget_line_name,
      counts: {
        contacts: e.counts.contacts,
        referrals_given: e.counts.referrals_given,
        referral_followups: e.counts.referral_followups,
        rides_provided: e.counts.rides_provided,
        applications_completed: e.counts.applications_completed,
        other: e.counts.other.map((o) => ({ label: o.label, value: o.value })),
      },
      notes: e.notes,
    })),
    lines: invoice.lines.map((l) => ({
      budget_line_id: l.budget_line_id,
      budget_line_name: l.budget_line_name,
      quarters: l.quarters,
      rate_cents: l.rate_cents,
      amount_cents: l.amount_cents,
    })),
    total_quarters: invoice.total_quarters,
    total_cents: invoice.total_cents,
  });
}

const FORMS: Record<number, (invoice: FingerprintedInvoice) => string> = { 1: canonicalFormV1 };

/** The canonical string for the invoice's own canonical version. */
export function canonicalForm(invoice: FingerprintedInvoice): string {
  const form = FORMS[invoice.canonical_version];
  if (!form) throw new RangeError(`Unknown canonical version ${String(invoice.canonical_version)}`);
  return form(invoice);
}

/** SHA-256 of a string as 64 lower-case hex characters (WebCrypto). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintOf(invoice: FingerprintedInvoice): Promise<string> {
  return sha256Hex(canonicalForm(invoice));
}

/** 3f9a21c7… → "3F9A-21C7", as printed on the PDF. */
export function shortFingerprint(fingerprint: string): string {
  if (!/^[0-9a-f]{64}$/.test(fingerprint)) throw new RangeError('Not a SHA-256 hex fingerprint');
  return `${fingerprint.slice(0, 4)}-${fingerprint.slice(4, 8)}`.toUpperCase();
}

/** True when the stored fingerprint matches the invoice's data. */
export async function verifyFingerprint(invoice: Invoice): Promise<boolean> {
  return (await fingerprintOf(invoice)) === invoice.fingerprint;
}
