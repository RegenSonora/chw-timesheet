// Step-by-step data upgrades (CLAUDE.md rule 7). Each step is a pure function from one
// version's stores to the next. The IndexedDB adapter runs them inside the upgrade
// transaction, so a step that throws leaves the old data and version untouched.
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

/** v1 is the first release; there is nothing to upgrade from yet. */
export const SCHEMA: Schema = {
  version: DATA_VERSION,
  layouts: { 1: STORES_V1 },
  steps: {},
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
