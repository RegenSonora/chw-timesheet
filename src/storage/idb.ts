// A small hand-written IndexedDB wrapper (no library): open with upgrades, and transactions
// that commit all or nothing.
import { META_ID, type MetaRecord } from './records';
import { runUpgrades, type Schema, type Snapshot } from './upgrades';
import type { BeforeWrite, Backend, StoreName, StoredRecord, Tx } from './types';

export type OpenProblem =
  /** An upgrade step failed; the old data is untouched. */
  | 'upgrade_failed'
  /** The phone holds data from a newer app version. */
  | 'newer_data'
  /** IndexedDB is missing or refused to open (private mode, storage full). */
  | 'unavailable';

export type OpenResult =
  { ok: true; db: IDBDatabase } | { ok: false; reason: OpenProblem; error: unknown };

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed'));
    };
  });
}

function createLayout(db: IDBDatabase, stores: readonly string[]) {
  for (const name of stores) db.createObjectStore(name, { keyPath: 'id' });
}

/**
 * Read every store, run the pure upgrade steps, then rebuild the stores. Uses callbacks
 * only, so the upgrade transaction never goes inactive between steps.
 */
function upgradeInPlace(
  db: IDBDatabase,
  tx: IDBTransaction,
  from: number,
  schema: Schema,
  now: string,
) {
  const names = [...db.objectStoreNames];
  const snapshot: Snapshot = {};
  let pending = names.length;
  const fail = () => {
    try {
      tx.abort();
    } catch {
      // Already aborting.
    }
  };
  const afterRead = () => {
    let next: Snapshot;
    try {
      next = runUpgrades(snapshot, from, schema.version, schema.steps);
      const layout = schema.layouts[schema.version];
      if (!layout) throw new Error(`No layout for data version ${String(schema.version)}`);
      for (const name of names) db.deleteObjectStore(name);
      createLayout(db, layout);
      const oldMeta = snapshot['meta']?.find((r) => r.id === META_ID) as MetaRecord | undefined;
      const meta: MetaRecord = {
        id: META_ID,
        data_version: schema.version,
        created_at: oldMeta?.created_at ?? now,
        updated_at: now,
      };
      next['meta'] = [meta];
      for (const name of layout) {
        const store = tx.objectStore(name);
        for (const record of next[name] ?? []) store.put(record);
      }
    } catch {
      fail();
    }
  };
  if (pending === 0) {
    afterRead();
    return;
  }
  for (const name of names) {
    const req = tx.objectStore(name).getAll();
    req.onsuccess = () => {
      snapshot[name] = req.result as StoredRecord[];
      if (--pending === 0) afterRead();
    };
    req.onerror = fail;
  }
}

export function openDatabase(
  factory: IDBFactory,
  name: string,
  schema: Schema,
  now: string,
): Promise<OpenResult> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(name, schema.version);
    } catch (error) {
      resolve({ ok: false, reason: 'unavailable', error });
      return;
    }
    let upgrading = false;
    req.onupgradeneeded = (event) => {
      upgrading = true;
      const db = req.result;
      const tx = req.transaction;
      if (!tx) return;
      if (event.oldVersion === 0) {
        const layout = schema.layouts[schema.version] ?? [];
        createLayout(db, layout);
        tx.objectStore('meta').put({
          id: META_ID,
          data_version: schema.version,
          created_at: now,
          updated_at: now,
        } satisfies MetaRecord);
        return;
      }
      upgradeInPlace(db, tx, event.oldVersion, schema, now);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab is opening a newer version: let it.
      db.onversionchange = () => {
        db.close();
      };
      resolve({ ok: true, db });
    };
    req.onerror = (event) => {
      event.preventDefault();
      const error = req.error;
      if (error?.name === 'VersionError') resolve({ ok: false, reason: 'newer_data', error });
      else if (upgrading) resolve({ ok: false, reason: 'upgrade_failed', error });
      else resolve({ ok: false, reason: 'unavailable', error });
    };
  });
}

export function createIdbBackend(db: IDBDatabase, beforeWrite?: BeforeWrite): Backend {
  async function run<T>(
    stores: readonly StoreName[],
    mode: IDBTransactionMode,
    body: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    const tx = db.transaction(stores, mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        resolve();
      };
      tx.onabort = () => {
        reject(tx.error ?? new Error('Transaction was aborted'));
      };
    });
    const abort = () => {
      try {
        tx.abort();
      } catch {
        // Already finished or aborting.
      }
    };
    const wrapped: Tx = {
      get: (store, key) => request(tx.objectStore(store).get(key)),
      getAll: (store) => request(tx.objectStore(store).getAll()),
      async put(store, value) {
        beforeWrite?.(store, abort);
        await request(tx.objectStore(store).put(value));
      },
      async delete(store, key) {
        beforeWrite?.(store, abort);
        await request(tx.objectStore(store).delete(key));
      },
    };
    let result: T;
    try {
      result = await body(wrapped);
    } catch (error) {
      abort();
      await done.catch(() => undefined);
      throw error;
    }
    await done;
    return result;
  }

  return {
    read: (stores, body) => run(stores, 'readonly', body),
    write: (stores, body) => run(stores, 'readwrite', body),
    close: () => {
      db.close();
    },
  };
}
