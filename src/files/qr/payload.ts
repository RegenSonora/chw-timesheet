// QR code payload (SPEC §7, decision 0011). Never change v1: a new layout gets a new version,
// and the golden test keeps v1 producing the same text.
import type { Invoice } from '../../core/types';

export const QR_PAYLOAD_VERSION = 1;

/** Compact JSON: invoice #, period, [budget line id, quarter-hours, cents] per line, fingerprint. */
export function qrPayloadV1(
  invoice: Pick<Invoice, 'number' | 'period_start' | 'period_end' | 'lines' | 'fingerprint'>,
): string {
  // Built by hand so key order and spacing can't drift with JSON.stringify options.
  const str = (s: string) => JSON.stringify(s);
  const lines = invoice.lines
    .map((l) => `[${str(l.budget_line_id)},${String(l.quarters)},${String(l.amount_cents)}]`)
    .join(',');
  return (
    `{"v":1,"n":${str(invoice.number)},` +
    `"p":[${str(invoice.period_start)},${str(invoice.period_end)}],` +
    `"l":[${lines}],"f":${str(invoice.fingerprint)}}`
  );
}
