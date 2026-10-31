// Invoice builder (SPEC §6): one funding source, every uninvoiced entry for it.
import { sumCounts } from './counts';
import { CANONICAL_VERSION, fingerprintOf, type FingerprintedInvoice } from './fingerprint';
import { formatInvoiceNumber, normalizeInitials, takeNumber } from './invoice-number';
import { lineAmountCents, sumCents } from './money';
import { checkEntryTimes, entryDateOf, parseIso } from './time';
import type {
  Entry,
  FundingSourceConfig,
  Invoice,
  InvoiceCounter,
  InvoiceEntry,
  InvoiceLine,
  NteStatus,
  Profile,
  SourceSettings,
} from './types';

export interface InvoiceInput {
  /** New invoice UUID. */
  id: string;
  /** Creation time, ISO 8601 with offset. */
  now: string;
  /** YYYY-MM-DD, the day it is generated. */
  invoice_date: string;
  source: FundingSourceConfig;
  settings: SourceSettings;
  profile: Profile;
  counter: InvoiceCounter;
  /** All entries on the phone; only this source's uninvoiced ones are used. */
  entries: readonly Entry[];
  /** All invoices on the phone, for the NTE tracker and all-time counts. */
  prior_invoices: readonly Invoice[];
}

export type InvoiceProblem =
  | { reason: 'no_entries' }
  | { reason: 'no_rate' }
  | { reason: 'bad_initials' }
  | { reason: 'bad_settings' }
  | { reason: 'bad_date' }
  | { reason: 'bad_entry'; entry_id: string };

export type InvoiceDraftResult =
  | { ok: true; invoice: FingerprintedInvoice; counter: InvoiceCounter; entry_ids: string[] }
  | ({ ok: false } & InvoiceProblem);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(text: string): boolean {
  return DATE.test(text) && new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) === text;
}

/** The uninvoiced entries a Generate button for this source would bill (SPEC §6). */
export function uninvoicedEntries(entries: readonly Entry[], sourceId: string): Entry[] {
  return entries.filter((e) => e.source_id === sourceId && e.invoice_id === null);
}

/**
 * Everything the invoice preview shows, without the fingerprint. Pure and synchronous;
 * createInvoice adds the fingerprint.
 */
export function buildInvoiceDraft(input: InvoiceInput): InvoiceDraftResult {
  const { source, settings, profile } = input;
  if (settings.source_id !== source.id) return { ok: false, reason: 'bad_settings' };
  if (!Number.isSafeInteger(settings.rate_cents) || settings.rate_cents < 1) {
    return { ok: false, reason: 'no_rate' };
  }
  if (normalizeInitials(profile.initials) !== profile.initials) {
    return { ok: false, reason: 'bad_initials' };
  }
  if (!isDate(input.invoice_date)) return { ok: false, reason: 'bad_date' };

  const tasks = new Map(source.tasks.map((t) => [t.id, t]));
  const lines = new Map(source.budget_lines.map((l) => [l.id, l]));
  const billed = uninvoicedEntries(input.entries, source.id);
  if (billed.length === 0) return { ok: false, reason: 'no_entries' };

  const frozen: InvoiceEntry[] = [];
  for (const e of billed) {
    const task = tasks.get(e.task_id);
    const line = lines.get(e.budget_line_id);
    const times = checkEntryTimes(e.start, e.stop);
    if (!task || !line || !times.ok || entryDateOf(e.start) !== e.entry_date) {
      return { ok: false, reason: 'bad_entry', entry_id: e.id };
    }
    frozen.push({
      id: e.id,
      start: e.start,
      stop: e.stop,
      entry_date: e.entry_date,
      quarters: times.quarters,
      task_id: task.id,
      task_name: task.name,
      core_competency: task.core_competency,
      budget_line_id: line.id,
      budget_line_name: line.name,
      counts: structuredClone(e.counts),
      notes: e.notes,
      created_at: e.created_at,
      updated_at: e.updated_at,
    });
  }
  frozen.sort(
    (a, b) =>
      parseIso(a.start).epochMs - parseIso(b.start).epochMs ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  // One line per budget line with hours, in the source's order (decision 0002).
  const invoiceLines: InvoiceLine[] = [];
  for (const line of source.budget_lines) {
    const quarters = frozen
      .filter((e) => e.budget_line_id === line.id)
      .reduce((sum, e) => sum + e.quarters, 0);
    if (quarters === 0) continue;
    invoiceLines.push({
      budget_line_id: line.id,
      budget_line_name: line.name,
      quarters,
      rate_cents: settings.rate_cents,
      amount_cents: lineAmountCents(quarters, settings.rate_cents),
    });
  }
  const totalCents = sumCents(invoiceLines.map((l) => l.amount_cents));
  const totalQuarters = invoiceLines.reduce((sum, l) => sum + l.quarters, 0);

  const earlier = input.prior_invoices.filter((i) => i.source.id === source.id);
  const nte = nteStatus(source, settings, earlier, totalCents);
  const countsPeriod = sumCounts(frozen.map((e) => e.counts));
  const countsAllTime = sumCounts([...earlier.map((i) => i.counts_period), countsPeriod]);

  const dates = frozen.map((e) => e.entry_date).sort();
  const { sequence, counter } = takeNumber(input.counter);
  const year = Number(input.invoice_date.slice(0, 4));

  return {
    ok: true,
    counter,
    entry_ids: frozen.map((e) => e.id),
    invoice: {
      id: input.id,
      number: formatInvoiceNumber(profile.initials, year, sequence),
      sequence,
      source: {
        id: source.id,
        code: source.code,
        name: source.name,
        version: source.version,
        certification_text: source.certification_text,
      },
      chw: {
        name: profile.name,
        initials: profile.initials,
        mailing_address: profile.mailing_address,
      },
      invoice_date: input.invoice_date,
      period_start: dates[0] ?? '',
      period_end: dates[dates.length - 1] ?? '',
      rate_cents: settings.rate_cents,
      entries: frozen,
      lines: invoiceLines,
      total_quarters: totalQuarters,
      total_cents: totalCents,
      counts_period: countsPeriod,
      counts_all_time: countsAllTime,
      nte,
      canonical_version: CANONICAL_VERSION,
      created_at: input.now,
      updated_at: input.now,
    },
  };
}

function nteStatus(
  source: FundingSourceConfig,
  settings: SourceSettings,
  earlier: readonly Invoice[],
  thisInvoiceCents: number,
): NteStatus {
  if (!source.has_nte) return { state: 'none' };
  if (settings.nte_cents === null) return { state: 'not_entered' };
  const billedBefore = sumCents(earlier.map((i) => i.total_cents));
  const remaining = settings.nte_cents - billedBefore - thisInvoiceCents;
  return {
    state: 'tracked',
    nte_cents: settings.nte_cents,
    billed_before_cents: billedBefore,
    this_invoice_cents: thisInvoiceCents,
    remaining_cents: remaining,
    over: remaining < 0,
  };
}

export type InvoiceResult =
  | { ok: true; invoice: Invoice; counter: InvoiceCounter; entry_ids: string[] }
  | ({ ok: false } & InvoiceProblem);

/** The finished invoice with its fingerprint. Storage saves it, locks entry_ids and stores counter in one transaction. */
export async function createInvoice(input: InvoiceInput): Promise<InvoiceResult> {
  const draft = buildInvoiceDraft(input);
  if (!draft.ok) return draft;
  const fingerprint = await fingerprintOf(draft.invoice);
  return { ...draft, invoice: { ...draft.invoice, fingerprint } };
}
