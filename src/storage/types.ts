// The Storage interface screens use, and the small transaction interface both adapters implement.
import type { InvoiceResult } from '../core/invoice';
import type {
  Counts,
  Entry,
  FundingSourceConfig,
  Invoice,
  InvoiceCounter,
  Profile,
  SourceSettings,
} from '../core/types';

/** What the app remembers between screens (SPEC §5). */
export interface AppState {
  /** Set while a timer runs, so it survives closing the app. */
  running_timer: { start: string; source_id: string } | null;
  /** The header chip's funding source. */
  selected_source_id: string | null;
  /** Kept per source because each source has its own tasks and budget lines. */
  per_source: Record<string, SourcePicks>;
  /** The half-entered record, saved on every tap so an interruption never loses it (SPEC §10). */
  draft: Draft | null;
}

export type Draft = EntryDraft | SetupDraft;

/** A new entry or an edit in progress (SPEC §5). */
export interface EntryDraft {
  kind: 'entry';
  /** Null for a new entry; the entry's id when editing. */
  entry_id: string | null;
  /** The screen to return to after an interruption. */
  step: 'times' | 'task' | 'counts' | 'edit';
  /** "Enter times" fields as typed: YYYY-MM-DD, HH:MM, HH:MM. Null for a timer entry. */
  hand: { date: string; start: string; end: string } | null;
  /** Raw times, ISO 8601 with offset. Null until valid times are known. */
  start: string | null;
  stop: string | null;
  source_id: string;
  task_id: string | null;
  budget_line_id: string | null;
  counts: Counts;
  notes: string;
}

/** The setup form as typed, before the profile exists. */
export interface SetupDraft {
  kind: 'setup';
  name: string;
  initials: string;
  mailing_address: string;
  next_number: string;
  /** Per funding source id: picked or not, and the rate as typed. */
  sources: Record<string, { picked: boolean; rate: string }>;
}

export interface SourcePicks {
  /** The budget line the next entry defaults to. */
  last_budget_line_id: string | null;
  /** Most recent first, at most RECENT_TASKS_MAX. */
  recent_task_ids: string[];
}

export const RECENT_TASKS_MAX = 10;

export type SaveEntryResult = { ok: true } | { ok: false; reason: 'locked' | 'invoice_id_set' };
export type DeleteEntryResult = { ok: true } | { ok: false; reason: 'locked' | 'not_found' };
export type SetNextNumberResult =
  { ok: true; counter: InvoiceCounter } | { ok: false; reason: 'locked' | 'invalid' };

export interface GenerateInvoiceRequest {
  source: FundingSourceConfig;
  /** Creation time, ISO 8601 with offset. */
  now: string;
  /** YYYY-MM-DD, the day it is generated. */
  invoice_date: string;
}

export type GenerateInvoiceResult =
  | InvoiceResult
  /** No profile saved yet. */
  | { ok: false; reason: 'no_profile' }
  /** Entries, settings or the counter changed while the invoice was being built; nothing was saved. */
  | { ok: false; reason: 'changed' };

/**
 * Everything the app stores (CLAUDE.md rule 3). Invoices have no update or delete:
 * once generated they are frozen, and so are their entries (rule 5).
 */
export interface Storage {
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;

  getSourceSettings(sourceId: string): Promise<SourceSettings | null>;
  listSourceSettings(): Promise<SourceSettings[]>;
  saveSourceSettings(settings: SourceSettings): Promise<void>;

  getEntry(id: string): Promise<Entry | null>;
  /** Sorted by start, then id. */
  listEntries(): Promise<Entry[]>;
  /** Refused for invoiced entries, and for any entry that arrives with an invoice id. */
  saveEntry(entry: Entry): Promise<SaveEntryResult>;
  deleteEntry(id: string): Promise<DeleteEntryResult>;

  getInvoice(id: string): Promise<Invoice | null>;
  /** Sorted by invoice number sequence. */
  listInvoices(): Promise<Invoice[]>;

  getCounter(): Promise<InvoiceCounter>;
  /** Setup's starting number (decision 0005). Refused once an invoice exists. */
  setNextNumber(next: number): Promise<SetNextNumberResult>;

  getAppState(): Promise<AppState>;
  saveAppState(state: AppState): Promise<void>;

  /** Lock the source's uninvoiced entries, save the invoice and advance the counter, all or nothing. */
  generateInvoice(request: GenerateInvoiceRequest): Promise<GenerateInvoiceResult>;

  close(): void;
}

/** One transaction. Inside it, await only these calls: anything else lets IndexedDB commit early. */
export interface Tx {
  get(store: StoreName, key: string): Promise<unknown>;
  getAll(store: StoreName): Promise<unknown[]>;
  put(store: StoreName, value: StoredRecord): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
}

/** An adapter: IndexedDB on the phone, memory in tests. A throw inside write() undoes all of it. */
export interface Backend {
  read<T>(stores: readonly StoreName[], run: (tx: Tx) => Promise<T>): Promise<T>;
  write<T>(stores: readonly StoreName[], run: (tx: Tx) => Promise<T>): Promise<T>;
  close(): void;
}

/** Test-only: called before every put or delete. Throw, or call abort, to interrupt the transaction. */
export type BeforeWrite = (store: StoreName, abort: () => void) => void;

export type StoreName =
  'meta' | 'profile' | 'source_settings' | 'entries' | 'invoices' | 'counter' | 'app_state';

/** Every stored record is keyed by `id`. */
export interface StoredRecord {
  id: string;
}
