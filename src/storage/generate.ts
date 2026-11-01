// Generate an invoice (SPEC §6, CLAUDE.md rule 5): lock entries, save the invoice and advance
// the counter in ONE transaction.
//
// The fingerprint needs WebCrypto, and an IndexedDB transaction commits as soon as the code
// awaits anything else. So: read in one transaction, build the invoice with its fingerprint
// outside any transaction, then check nothing moved and write everything in a second one.
import { createInvoice, uninvoicedEntries } from '../core/invoice';
import { newCounter } from '../core/invoice-number';
import type { Entry, Invoice, InvoiceCounter, Profile, SourceSettings } from '../core/types';
import { readSingleton, readSourceSettings, unwrap, wrap, type Wrapped } from './records';
import type { Backend, GenerateInvoiceRequest, GenerateInvoiceResult, Tx } from './types';

export interface GenerateHooks {
  /** Test-only: runs after the invoice is built and before the write transaction opens. */
  beforeWrite?: () => Promise<void>;
}

interface Snapshot {
  profile: Wrapped<Profile> | undefined;
  settings: Wrapped<SourceSettings> | undefined;
  counter: Wrapped<InvoiceCounter> | undefined;
  entries: Entry[];
  invoices: Invoice[];
}

const STORES = ['profile', 'source_settings', 'counter', 'entries', 'invoices'] as const;

async function readSnapshot(tx: Tx, sourceId: string): Promise<Snapshot> {
  return {
    profile: await readSingleton<Profile>(tx, 'profile'),
    settings: await readSourceSettings(tx, sourceId),
    counter: await readSingleton<InvoiceCounter>(tx, 'counter'),
    entries: (await tx.getAll('entries')) as Entry[],
    invoices: (await tx.getAll('invoices')) as Invoice[],
  };
}

/** What the invoice was built from: if any of it differs at write time, nothing is saved. */
function fingerprintOfInputs(snap: Snapshot, sourceId: string): string {
  const open = uninvoicedEntries(snap.entries, sourceId)
    .map((e) => `${e.id}@${e.updated_at}`)
    .sort();
  return JSON.stringify([
    snap.profile?.updated_at ?? null,
    snap.settings?.updated_at ?? null,
    snap.counter ? [snap.counter.next, snap.counter.locked, snap.counter.updated_at] : null,
    open,
    snap.invoices.map((i) => i.id).sort(),
  ]);
}

export async function generateInvoice(
  backend: Backend,
  request: GenerateInvoiceRequest,
  deps: { now: () => string; newId: () => string; hooks: GenerateHooks },
): Promise<GenerateInvoiceResult> {
  const sourceId = request.source.id;
  const before = await backend.read(STORES, (tx) => readSnapshot(tx, sourceId));
  if (!before.profile) return { ok: false, reason: 'no_profile' };
  if (!before.settings) return { ok: false, reason: 'no_rate' };

  const result = await createInvoice({
    id: deps.newId(),
    now: request.now,
    invoice_date: request.invoice_date,
    source: request.source,
    settings: unwrap(before.settings),
    profile: unwrap(before.profile),
    counter: before.counter ? unwrap(before.counter) : newCounter(),
    entries: before.entries,
    prior_invoices: before.invoices,
  });
  if (!result.ok) return result;

  await deps.hooks.beforeWrite?.();

  const expected = fingerprintOfInputs(before, sourceId);
  return backend.write(STORES, async (tx) => {
    const current = await readSnapshot(tx, sourceId);
    if (fingerprintOfInputs(current, sourceId) !== expected) {
      return { ok: false, reason: 'changed' } as const;
    }
    const byId = new Map(current.entries.map((e) => [e.id, e]));
    for (const id of result.entry_ids) {
      const entry = byId.get(id);
      // Can't happen after the check above; throwing undoes any entry already locked.
      if (!entry) throw new Error(`Entry ${id} vanished during generateInvoice`);
      const locked: Entry = { ...entry, invoice_id: result.invoice.id, updated_at: request.now };
      await tx.put('entries', locked);
    }
    await tx.put('invoices', result.invoice);
    await tx.put('counter', wrap(result.counter, current.counter, deps.now(), deps.newId));
    return result;
  });
}
