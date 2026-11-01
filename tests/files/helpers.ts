// Invoices for the file writer tests, built by the real rules from the M1 fixtures.
import { createInvoice, type InvoiceInput } from '../../src/core/invoice';
import type { Invoice } from '../../src/core/types';
import { sampleInput } from '../core/fixtures/wireframe-sample';

export async function invoiceFrom(overrides: Partial<InvoiceInput> = {}): Promise<Invoice> {
  const result = await createInvoice(sampleInput(overrides));
  if (!result.ok) throw new Error(result.reason);
  return result.invoice;
}

/** The wireframe sample: CC-2026-004, 8 entries on 8 dates, $185.00, over the NTE. */
export const sampleInvoice = () => invoiceFrom();

const BOM = '\uFEFF';

/** Bytes → text, checking the UTF-8 byte-order mark is there. */
export function csvText(bytes: Uint8Array): string {
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  if (!text.startsWith(BOM)) throw new Error('CSV has no byte-order mark');
  return text.slice(1);
}
