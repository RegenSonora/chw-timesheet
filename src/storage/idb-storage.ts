// The IndexedDB adapter the app uses on the phone (CLAUDE.md rule 3).
import { createIdbBackend, openDatabase, type OpenProblem } from './idb';
import { createStorage, phoneNow, type StorageOptions } from './storage';
import { SCHEMA, type Schema } from './upgrades';
import type { BeforeWrite, Storage } from './types';

export const DB_NAME = 'chw-timesheet';

export interface IdbOptions extends StorageOptions {
  /** Defaults to the browser's indexedDB. */
  indexedDB?: IDBFactory;
  /** Test-only: a different layout and upgrade table. */
  schema?: Schema;
  /** Test-only: interrupt write transactions. */
  beforeWrite?: BeforeWrite;
}

export type OpenStorageResult =
  { ok: true; storage: Storage } | { ok: false; reason: OpenProblem; error: unknown };

export async function openIdbStorage(
  name = DB_NAME,
  options: IdbOptions = {},
): Promise<OpenStorageResult> {
  const {
    indexedDB: factory = globalThis.indexedDB,
    schema = SCHEMA,
    beforeWrite,
    ...rest
  } = options;
  if (typeof factory === 'undefined') {
    return { ok: false, reason: 'unavailable', error: new Error('No IndexedDB') };
  }
  const opened = await openDatabase(factory, name, schema, (rest.now ?? phoneNow)());
  if (!opened.ok) return opened;
  return { ok: true, storage: createStorage(createIdbBackend(opened.db, beforeWrite), rest) };
}
