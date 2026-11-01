// Home's "Not yet invoiced" line (SPEC §5): entry count, hours and amount for one source.
import { uninvoicedEntries } from './invoice';
import { lineAmountCents, sumCents } from './money';
import { checkEntryTimes } from './time';
import type { Entry } from './types';

export interface UninvoicedSummary {
  count: number;
  quarters: number;
  /** Null until the source has a rate. */
  amount_cents: number | null;
}

/**
 * Rounded the way the invoice is: quarters summed per budget line, each line amount rounded
 * once, then added (SPEC §6). So this always equals the invoice the Generate button would make.
 */
export function uninvoicedSummary(
  entries: readonly Entry[],
  sourceId: string,
  rateCents: number | null,
): UninvoicedSummary {
  const open = uninvoicedEntries(entries, sourceId);
  const perLine = new Map<string, number>();
  for (const e of open) {
    const times = checkEntryTimes(e.start, e.stop);
    const quarters = times.ok ? times.quarters : 0;
    perLine.set(e.budget_line_id, (perLine.get(e.budget_line_id) ?? 0) + quarters);
  }
  const lines = [...perLine.values()];
  return {
    count: open.length,
    quarters: lines.reduce((sum, q) => sum + q, 0),
    amount_cents:
      rateCents === null ? null : sumCents(lines.map((q) => lineAmountCents(q, rateCents))),
  };
}
