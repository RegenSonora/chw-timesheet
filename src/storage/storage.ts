// Storage rules shared by both adapters: locked entries, the counter, singletons (CLAUDE.md rules 3, 5).
import { newCounter, setNextNumber } from '../core/invoice-number';
import { toIsoWithOffset } from '../core/time';
import type { Entry, Invoice, InvoiceCounter, Profile, SourceSettings } from '../core/types';
import { generateInvoice, type GenerateHooks } from './generate';
import { readSingleton, readSourceSettings, unwrap, wrap, type Wrapped } from './records';
import {
  RECENT_TASKS_MAX,
  type AppState,
  type Backend,
  type Storage,
  type StoreName,
} from './types';

export interface StorageOptions {
  /** Current time, ISO 8601 with offset. Defaults to the phone's clock and time zone. */
  now?: () => string;
  /** New record ids. Defaults to crypto.randomUUID(). */
  newId?: () => string;
  /** Test-only hooks inside generateInvoice. */
  generateHooks?: GenerateHooks;
}

export function phoneNow(): string {
  const ms = Date.now();
  return toIsoWithOffset(ms, -new Date(ms).getTimezoneOffset());
}

export function emptyAppState(): AppState {
  return { running_timer: null, selected_source_id: null, per_source: {} };
}

/** After an entry is saved: its budget line becomes the default, its task moves to the front (SPEC §5). */
export function rememberPicks(
  state: AppState,
  sourceId: string,
  taskId: string,
  budgetLineId: string,
): AppState {
  const recent = state.per_source[sourceId]?.recent_task_ids ?? [];
  return {
    ...state,
    per_source: {
      ...state.per_source,
      [sourceId]: {
        last_budget_line_id: budgetLineId,
        recent_task_ids: [taskId, ...recent.filter((id) => id !== taskId)].slice(
          0,
          RECENT_TASKS_MAX,
        ),
      },
    },
  };
}

export function byStartThenId(a: Entry, b: Entry): number {
  const diff = Date.parse(a.start) - Date.parse(b.start);
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function createStorage(backend: Backend, options: StorageOptions = {}): Storage {
  const now = options.now ?? phoneNow;
  const newId = options.newId ?? (() => crypto.randomUUID());

  async function saveSingleton(store: StoreName, value: object): Promise<void> {
    await backend.write([store], async (tx) => {
      const existing = await readSingleton<object>(tx, store);
      await tx.put(store, wrap(value, existing, now(), newId));
    });
  }

  return {
    async getProfile() {
      const record = await backend.read(['profile'], (tx) => readSingleton<Profile>(tx, 'profile'));
      return record ? unwrap(record) : null;
    },

    saveProfile: (profile) => saveSingleton('profile', profile),

    async getSourceSettings(sourceId) {
      const record = await backend.read(['source_settings'], (tx) =>
        readSourceSettings(tx, sourceId),
      );
      return record ? unwrap(record) : null;
    },

    async listSourceSettings() {
      const all = await backend.read(['source_settings'], (tx) => tx.getAll('source_settings'));
      return (all as Wrapped<SourceSettings>[]).map((r) => unwrap(r));
    },

    async saveSourceSettings(settings) {
      await backend.write(['source_settings'], async (tx) => {
        const existing = await readSourceSettings(tx, settings.source_id);
        await tx.put('source_settings', wrap(settings, existing, now(), newId));
      });
    },

    async getEntry(id) {
      const entry = await backend.read(['entries'], (tx) => tx.get('entries', id));
      return (entry as Entry | undefined) ?? null;
    },

    async listEntries() {
      const all = (await backend.read(['entries'], (tx) => tx.getAll('entries'))) as Entry[];
      return all.sort(byStartThenId);
    },

    saveEntry(entry) {
      return backend.write(['entries'], async (tx) => {
        // Only generateInvoice locks entries.
        if (entry.invoice_id !== null) return { ok: false, reason: 'invoice_id_set' } as const;
        const existing = (await tx.get('entries', entry.id)) as Entry | undefined;
        if (existing && existing.invoice_id !== null) {
          return { ok: false, reason: 'locked' } as const;
        }
        await tx.put('entries', entry);
        return { ok: true } as const;
      });
    },

    deleteEntry(id) {
      return backend.write(['entries'], async (tx) => {
        const existing = (await tx.get('entries', id)) as Entry | undefined;
        if (!existing) return { ok: false, reason: 'not_found' } as const;
        if (existing.invoice_id !== null) return { ok: false, reason: 'locked' } as const;
        await tx.delete('entries', id);
        return { ok: true } as const;
      });
    },

    async getInvoice(id) {
      const invoice = await backend.read(['invoices'], (tx) => tx.get('invoices', id));
      return (invoice as Invoice | undefined) ?? null;
    },

    async listInvoices() {
      const all = (await backend.read(['invoices'], (tx) => tx.getAll('invoices'))) as Invoice[];
      return all.sort((a, b) => a.sequence - b.sequence);
    },

    async getCounter() {
      const record = await backend.read(['counter'], (tx) =>
        readSingleton<InvoiceCounter>(tx, 'counter'),
      );
      return record ? unwrap(record) : newCounter();
    },

    setNextNumber(next) {
      return backend.write(['counter'], async (tx) => {
        const existing = await readSingleton<InvoiceCounter>(tx, 'counter');
        const result = setNextNumber(existing ? unwrap(existing) : newCounter(), next);
        if (result.ok) await tx.put('counter', wrap(result.counter, existing, now(), newId));
        return result;
      });
    },

    async getAppState() {
      const record = await backend.read(['app_state'], (tx) =>
        readSingleton<AppState>(tx, 'app_state'),
      );
      return record ? unwrap(record) : emptyAppState();
    },

    saveAppState: (state) => saveSingleton('app_state', state),

    generateInvoice: (request) =>
      generateInvoice(backend, request, { now, newId, hooks: options.generateHooks ?? {} }),

    close: () => {
      backend.close();
    },
  };
}
