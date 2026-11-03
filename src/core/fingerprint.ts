// Invoice fingerprint (SPEC §7, CLAUDE.md rule 8): SHA-256 over a versioned canonical form.
// Never change a canonical form. A new form gets a new version and older invoices keep verifying.
import { canonicalJson } from './canonical';
import type { Counts, Invoice, InvoiceEntry, InvoiceTaskShare } from './types';

/** The version new invoices get. v2: several tasks per entry (decision 0024). */
export const CANONICAL_VERSION = 2;

/** The fields an invoice is fingerprinted over: header, entries, lines, totals and rate. */
export type FingerprintedInvoice = Omit<Invoice, 'fingerprint'>;

/** Forms v1 and v2 hold the five CHW counts data v3 had, read from the map (data v4). */
function countsForm(counts: Counts) {
  const value = (id: string) => counts.values[id] ?? 0;
  return {
    contacts: value('contacts'),
    referrals_given: value('referrals_given'),
    referral_followups: value('referral_followups'),
    rides_provided: value('rides_provided'),
    applications_completed: value('applications_completed'),
    other: counts.other.map((o) => ({ label: o.label, value: o.value })),
  };
}

/** A v1 invoice entry had exactly one task; data v3 stores it as a single share. */
function onlyTask(e: InvoiceEntry): InvoiceTaskShare {
  const [only, ...more] = e.tasks;
  if (!only || more.length > 0) throw new RangeError('A v1 invoice entry has exactly one task');
  return only;
}

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
    entries: invoice.entries.map((e) => {
      const task = onlyTask(e);
      return {
        id: e.id,
        start: e.start,
        stop: e.stop,
        entry_date: e.entry_date,
        quarters: e.quarters,
        task_id: task.task_id,
        task_name: task.task_name,
        core_competency: task.core_competency,
        budget_line_id: e.budget_line_id,
        budget_line_name: e.budget_line_name,
        counts: countsForm(e.counts),
        notes: e.notes,
      };
    }),
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

/** Canonical form v2: as v1, but each entry lists its task shares (decision 0024). */
export function canonicalFormV2(invoice: FingerprintedInvoice): string {
  return canonicalJson({
    v: 2,
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
      tasks: e.tasks.map((t) => ({
        task_id: t.task_id,
        task_name: t.task_name,
        core_competency: t.core_competency,
        quarters: t.quarters,
      })),
      budget_line_id: e.budget_line_id,
      budget_line_name: e.budget_line_name,
      counts: countsForm(e.counts),
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

const FORMS: Record<number, (invoice: FingerprintedInvoice) => string> = {
  1: canonicalFormV1,
  2: canonicalFormV2,
};

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
