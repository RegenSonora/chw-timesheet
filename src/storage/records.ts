// Stored layout, data format version 1 (CLAUDE.md rule 7). Change it only with a new version
// and an upgrade step in upgrades.ts.
import type { SourceSettings } from '../core/types';
import type { StoreName, StoredRecord, Tx } from './types';

export const DATA_VERSION = 1;

export const STORES_V1: readonly StoreName[] = [
  'meta',
  'profile',
  'source_settings',
  'entries',
  'invoices',
  'counter',
  'app_state',
];

/** The one record in `meta`: which data format version the stores hold. */
export interface MetaRecord extends StoredRecord {
  id: 'data';
  data_version: number;
  created_at: string;
  updated_at: string;
}

export const META_ID = 'data';

/**
 * Profile, source settings, counter and app state are plain values in src/core. Stored, they
 * get a UUID and timestamps like every other record (CLAUDE.md data conventions).
 */
export type Wrapped<T> = T & { id: string; created_at: string; updated_at: string };

export function wrap<T extends object>(
  value: T,
  existing: Wrapped<T> | undefined,
  now: string,
  newId: () => string,
): Wrapped<T> {
  return {
    ...value,
    id: existing?.id ?? newId(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function unwrap<T extends object>(record: Wrapped<T>): T {
  const value: Partial<Wrapped<T>> = { ...record };
  delete value.id;
  delete value.created_at;
  delete value.updated_at;
  return value as T;
}

/** The first (and only) record of a singleton store. */
export async function readSingleton<T extends object>(
  tx: Tx,
  store: StoreName,
): Promise<Wrapped<T> | undefined> {
  const all = (await tx.getAll(store)) as Wrapped<T>[];
  return all[0];
}

export async function readSourceSettings(
  tx: Tx,
  sourceId: string,
): Promise<Wrapped<SourceSettings> | undefined> {
  const all = (await tx.getAll('source_settings')) as Wrapped<SourceSettings>[];
  return all.find((s) => s.source_id === sourceId);
}
