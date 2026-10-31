// Rate change check (SPEC §4): what to do when the CHW edits a source's hourly rate.

export type RateChangeCheck =
  | { kind: 'no_change' }
  /** Save the new rate without asking. */
  | { kind: 'apply' }
  /** Ask first: "You have N entries not yet invoiced. They will be billed at the new rate." */
  | { kind: 'confirm'; count: number; old_rate_cents: number; new_rate_cents: number };

export function rateChangeCheck(
  oldRateCents: number | null,
  newRateCents: number,
  uninvoicedCount: number,
): RateChangeCheck {
  if (!Number.isSafeInteger(newRateCents) || newRateCents < 1) {
    throw new RangeError(`Bad rate: ${String(newRateCents)}`);
  }
  if (!Number.isSafeInteger(uninvoicedCount) || uninvoicedCount < 0) {
    throw new RangeError(`Bad count: ${String(uninvoicedCount)}`);
  }
  if (oldRateCents === newRateCents) return { kind: 'no_change' };
  if (oldRateCents === null || uninvoicedCount === 0) return { kind: 'apply' };
  return {
    kind: 'confirm',
    count: uninvoicedCount,
    old_rate_cents: oldRateCents,
    new_rate_cents: newRateCents,
  };
}
