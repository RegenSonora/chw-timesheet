// Step-by-step data upgrades (CLAUDE.md rule 7). Each step is a pure function from one
// version's stores to the next. The IndexedDB adapter runs them inside the upgrade
// transaction, so a step that throws leaves the old data and version untouched.
import { checkEntryTimes } from '../core/time';
import { DATA_VERSION, STORES_V1 } from './records';
import type { StoredRecord } from './types';

/** Every store's records, by store name. Old versions may have stores v1 doesn't. */
export type Snapshot = Record<string, StoredRecord[]>;

/** Upgrade from version `key` to `key + 1`. */
export type UpgradeStep = (snapshot: Snapshot) => Snapshot;

export interface Schema {
  /** The data format version this app writes. */
  version: number;
  /** Store names per version. */
  layouts: Record<number, readonly string[]>;
  /** Upgrade steps by the version they start from. */
  steps: Record<number, UpgradeStep>;
}

/** v1 → v2: app state gains `draft`, empty until the CHW starts an entry or setup. */
export const v1ToV2: UpgradeStep = (snapshot) => ({
  ...snapshot,
  app_state: (snapshot['app_state'] ?? []).map((record) => ({ ...record, draft: null })),
});

type WithTask = StoredRecord & { task_id?: unknown };

/** Drop the one-task fields and put `tasks` where they were, keeping the other fields. */
function replaceTask(record: WithTask, tasks: unknown): StoredRecord {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'task_id') copy['tasks'] = tasks;
    else if (key !== 'task_name' && key !== 'core_competency') copy[key] = value;
  }
  return copy as unknown as StoredRecord;
}

/**
 * v2 → v3 (decision 0024): every entry's `task_id` becomes one task share holding all its billed
 * quarter-hours. The same goes for drafts (the share is filled in at save) and for entries frozen
 * in past invoices, which keep canonical form v1 and still verify.
 */
export const v2ToV3: UpgradeStep = (snapshot) => ({
  ...snapshot,
  entries: (snapshot['entries'] ?? []).map((record) => {
    const e = record as WithTask & { start: string; stop: string };
    const times = checkEntryTimes(e.start, e.stop);
    return replaceTask(e, [{ task_id: e.task_id, quarters: times.ok ? times.quarters : 0 }]);
  }),
  invoices: (snapshot['invoices'] ?? []).map((record) => {
    const invoice = record as StoredRecord & { entries: WithTask[] };
    return {
      ...invoice,
      entries: invoice.entries.map((e) => {
        const old = e as WithTask & {
          task_name: string;
          core_competency: string | null;
          quarters: number;
        };
        return replaceTask(old, [
          {
            task_id: old.task_id,
            task_name: old.task_name,
            core_competency: old.core_competency,
            quarters: old.quarters,
          },
        ]);
      }),
    };
  }),
  app_state: (snapshot['app_state'] ?? []).map((record) => {
    const state = record as StoredRecord & { draft: (WithTask & { kind: string }) | null };
    const draft = state.draft;
    if (draft?.kind !== 'entry') return state;
    const tasks =
      typeof draft.task_id === 'string' ? [{ task_id: draft.task_id, quarters: 0 }] : [];
    return { ...state, draft: replaceTask(draft, tasks) };
  }),
});

export const SCHEMA: Schema = {
  version: DATA_VERSION,
  layouts: { 1: STORES_V1, 2: STORES_V1, 3: STORES_V1 },
  steps: { 1: v1ToV2, 2: v2ToV3 },
};

/** Run every step from `from` up to `to`. Throws if one is missing or fails. */
export function runUpgrades(
  snapshot: Snapshot,
  from: number,
  to: number,
  steps: Record<number, UpgradeStep>,
): Snapshot {
  let current = structuredClone(snapshot);
  for (let v = from; v < to; v++) {
    const step = steps[v];
    if (!step) throw new Error(`No upgrade from data version ${String(v)}`);
    current = step(current);
  }
  return current;
}
