// My stats on Home (decision 0026): invoiced hours and the hours still needed for the raise and
// for CHW certification. Goals count invoiced hours only, as the office's records do.
import type { FundingSourceConfig, Invoice } from './types';

/** Quarter-hours invoiced for this source on this phone. */
export function invoicedQuarters(
  source: Pick<FundingSourceConfig, 'id'>,
  invoices: readonly Invoice[],
): number {
  return invoices
    .filter((i) => i.source.id === source.id)
    .reduce((sum, i) => sum + i.total_quarters, 0);
}

export type PayStat =
  | { state: 'counting'; left_quarters: number; after_quarters: number; rate_cents: number }
  /** The hours are reached but the rate in Settings is still lower. */
  | { state: 'reached'; after_quarters: number; rate_cents: number };

export type CertificationStat =
  | { state: 'counting'; left_quarters: number; after_quarters: number; name: string }
  | { state: 'eligible'; after_quarters: number; name: string };

export interface MyStats {
  invoiced_quarters: number;
  /** Logged but not yet invoiced; shown, never counted toward the goals. */
  waiting_quarters: number;
  /** Null when the source has no raise, or once it is reached and the rate changed. */
  pay: PayStat | null;
  /** Null when the source has no certification step. */
  certification: CertificationStat | null;
}

export function myStats(
  source: FundingSourceConfig,
  rateCents: number | null,
  invoices: readonly Invoice[],
  waitingQuarters: number,
): MyStats {
  const invoiced = invoicedQuarters(source, invoices);
  const step = source.rate_step;
  const cert = source.certification_step;

  let pay: PayStat | null = null;
  if (step) {
    const raised = rateCents !== null && rateCents >= step.rate_cents;
    if (invoiced < step.after_quarters) {
      pay = {
        state: 'counting',
        left_quarters: step.after_quarters - invoiced,
        after_quarters: step.after_quarters,
        rate_cents: step.rate_cents,
      };
    } else if (!raised) {
      pay = { state: 'reached', after_quarters: step.after_quarters, rate_cents: step.rate_cents };
    }
  }

  let certification: CertificationStat | null = null;
  if (cert) {
    certification =
      invoiced < cert.after_quarters
        ? {
            state: 'counting',
            left_quarters: cert.after_quarters - invoiced,
            after_quarters: cert.after_quarters,
            name: cert.name,
          }
        : { state: 'eligible', after_quarters: cert.after_quarters, name: cert.name };
  }

  return { invoiced_quarters: invoiced, waiting_quarters: waitingQuarters, pay, certification };
}
