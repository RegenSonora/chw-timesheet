// Shared record shapes. Field names are snake_case so stored and exported data read the same.
// Money is integer cents; hours are integer quarter-hours (CLAUDE.md data conventions).

/** A funding source file in src/funding-sources/ (schemas/funding-source.schema.json, SPEC §3). */
export interface FundingSourceConfig {
  format_version: 1;
  id: string;
  /** Short name for the chip, buttons and file names (decision 0006). */
  code: string;
  name: string;
  version: number;
  has_nte: boolean;
  default_rate_cents: number | null;
  /** NTE prefilled at setup (decision 0023). */
  default_nte_cents?: number;
  /** A raise after some billed hours; the app only reminds (decision 0023). */
  rate_step?: RateStep;
  certification_text: string;
  tasks: Task[];
  budget_lines: BudgetLine[];
}

export interface RateStep {
  /** Quarter-hours billed before the raise, e.g. 960 for 240 hours. */
  after_quarters: number;
  rate_cents: number;
}

export interface Task {
  id: string;
  name: string;
  /** Null when the task has none (Domestic support). */
  core_competency: string | null;
}

export interface BudgetLine {
  id: string;
  name: string;
}

/** The CHW's details (SPEC §4). */
export interface Profile {
  name: string;
  initials: string;
  mailing_address: string;
  /** Empty slot so a logo can be added later without redesign (SPEC §2). */
  logo: null;
}

/** Per funding source the CHW works under (SPEC §4). */
export interface SourceSettings {
  source_id: string;
  rate_cents: number;
  /** Not-to-exceed amount; null until entered. Ignored for sources without an NTE. */
  nte_cents: number | null;
}

export interface OtherCount {
  label: string;
  value: number;
}

/** Counts on an entry, or summed over many entries (SPEC §5). */
export interface Counts {
  contacts: number;
  referrals_given: number;
  referral_followups: number;
  rides_provided: number;
  applications_completed: number;
  /** "Add another count": label + number. */
  other: OtherCount[];
}

/** One block of logged time (SPEC §5). */
export interface Entry {
  id: string;
  source_id: string;
  /** Raw start, ISO 8601 with offset, whole seconds. */
  start: string;
  /** Raw stop, ISO 8601 with offset, whole seconds. */
  stop: string;
  /** YYYY-MM-DD: the start's local date. */
  entry_date: string;
  /** The tasks done, with the billed hours split between them (decision 0024). */
  tasks: TaskShare[];
  budget_line_id: string;
  counts: Counts;
  notes: string;
  /** Set when invoiced; the entry is then locked (CLAUDE.md rule 5). */
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

/** One task's part of an entry. The shares add up to the entry's billed quarter-hours. */
export interface TaskShare {
  task_id: string;
  quarters: number;
}

/** A task share as frozen into an invoice, with the names it was billed under. */
export interface InvoiceTaskShare {
  task_id: string;
  task_name: string;
  core_competency: string | null;
  quarters: number;
}

/** An entry as frozen into an invoice, with the names it was billed under. */
export interface InvoiceEntry {
  id: string;
  start: string;
  stop: string;
  entry_date: string;
  quarters: number;
  /** In the order the CHW checked them; quarters add up to `quarters`. */
  tasks: InvoiceTaskShare[];
  budget_line_id: string;
  budget_line_name: string;
  counts: Counts;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  budget_line_id: string;
  budget_line_name: string;
  quarters: number;
  rate_cents: number;
  amount_cents: number;
}

/** Contract tracking box (SPEC §6). Warning only, never a block. */
export type NteStatus =
  | { state: 'none' }
  | { state: 'not_entered' }
  | {
      state: 'tracked';
      nte_cents: number;
      billed_before_cents: number;
      this_invoice_cents: number;
      remaining_cents: number;
      over: boolean;
    };

/** An invoice. Never edited after creation (CLAUDE.md rule 5). */
export interface Invoice {
  id: string;
  /** e.g. CC-2026-004 */
  number: string;
  /** The counter value used, e.g. 4. */
  sequence: number;
  source: {
    id: string;
    code: string;
    name: string;
    version: number;
    certification_text: string;
  };
  chw: { name: string; initials: string; mailing_address: string };
  /** YYYY-MM-DD, the day it was generated. */
  invoice_date: string;
  period_start: string;
  period_end: string;
  rate_cents: number;
  /** Sorted by start, then id. */
  entries: InvoiceEntry[];
  /** In the source's budget line order (decision 0002). */
  lines: InvoiceLine[];
  total_quarters: number;
  total_cents: number;
  counts_period: Counts;
  /** This source on this phone, including this invoice. */
  counts_all_time: Counts;
  nte: NteStatus;
  canonical_version: number;
  /** SHA-256 of the canonical form, 64 lower-case hex characters. */
  fingerprint: string;
  created_at: string;
  updated_at: string;
}

/** One counter shared by all funding sources (SPEC §6, decision 0005). */
export interface InvoiceCounter {
  /** The number the next invoice gets. */
  next: number;
  /** True once an invoice has been created; the starting number can't change after. */
  locked: boolean;
}
