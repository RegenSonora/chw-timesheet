// Rate change check (SPEC §4): what to do when the CHW edits a source's hourly rate.
// Rate step reminder (decision 0023): when to tell the CHW a raise is due.
import type { FundingSourceConfig, Invoice } from './types';

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

export interface RateStepReminder {
  /** True while the hours that reach the step are still waiting: generate that invoice first. */
  invoice_first: boolean;
  after_quarters: number;
  rate_cents: number;
}

/**
 * A reminder once this source's billed plus waiting hours reach the source's rate step, until
 * the CHW's rate is at least the new rate. The app never changes the rate itself; an invoice
 * that crosses the step bills at one rate and the office settles the difference (decision 0023).
 */
export function rateStepReminder(
  source: FundingSourceConfig,
  rateCents: number | null,
  priorInvoices: readonly Invoice[],
  openQuarters: number,
): RateStepReminder | null {
  const step = source.rate_step;
  if (!step || rateCents === null || rateCents >= step.rate_cents) return null;
  const billed = priorInvoices
    .filter((i) => i.source.id === source.id)
    .reduce((sum, i) => sum + i.total_quarters, 0);
  if (billed + openQuarters < step.after_quarters) return null;
  return {
    invoice_first: billed < step.after_quarters,
    after_quarters: step.after_quarters,
    rate_cents: step.rate_cents,
  };
}
