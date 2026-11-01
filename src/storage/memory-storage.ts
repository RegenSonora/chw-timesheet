// In-memory adapter for tests (CLAUDE.md rule 3). Behaves like IndexedDB where it matters:
// records are copied in and out, a transaction only sees the stores it names, write
// transactions run one at a time, and a throw inside one leaves nothing behind.
import { createStorage, type StorageOptions } from './storage';
import type { BeforeWrite, Backend, Storage, StoreName, StoredRecord, Tx } from './types';
import { STORES_V1 } from './records';

export type MemoryData = Map<StoreName, Map<string, StoredRecord>>;

export interface MemoryOptions extends StorageOptions {
  beforeWrite?: BeforeWrite;
}

export function createMemoryBackend(beforeWrite?: BeforeWrite): Backend & { data: MemoryData } {
  const data: MemoryData = new Map(
    STORES_V1.map((name) => [name, new Map<string, StoredRecord>()]),
  );
  let queue: Promise<unknown> = Promise.resolve();

  function storeOf(view: MemoryData, allowed: readonly StoreName[], store: StoreName) {
    const map = view.get(store);
    if (!allowed.includes(store) || !map)
      throw new Error(`Store ${store} is not in this transaction`);
    return map;
  }

  function makeTx(
    view: MemoryData,
    allowed: readonly StoreName[],
    writable: boolean,
    state = { aborted: false },
  ): Tx {
    const live = () => {
      if (state.aborted) throw new Error('Transaction was aborted');
    };
    const writeCheck = (store: StoreName) => {
      live();
      if (!writable) throw new Error('Read-only transaction');
      beforeWrite?.(store, () => {
        state.aborted = true;
      });
      live();
    };
    return {
      get(store, key) {
        live();
        const value = storeOf(view, allowed, store).get(key);
        return Promise.resolve(value === undefined ? undefined : structuredClone(value));
      },
      getAll(store) {
        live();
        return Promise.resolve(
          [...storeOf(view, allowed, store).values()].map((v) => structuredClone(v)),
        );
      },
      put(store, value) {
        writeCheck(store);
        storeOf(view, allowed, store).set(value.id, structuredClone(value));
        return Promise.resolve();
      },
      delete(store, key) {
        writeCheck(store);
        storeOf(view, allowed, store).delete(key);
        return Promise.resolve();
      },
    };
  }

  return {
    data,
    read(stores, run) {
      return run(makeTx(data, stores, false));
    },
    write(stores, run) {
      const next = queue.then(async () => {
        // Work on copies; commit only if run() finishes without throwing.
        const draft: MemoryData = new Map(
          stores.map((name) => [name, new Map(data.get(name) ?? [])]),
        );
        const state = { aborted: false };
        const result = await run(makeTx(draft, stores, true, state));
        if (state.aborted) throw new Error('Transaction was aborted');
        for (const [name, map] of draft) data.set(name, map);
        return result;
      });
      queue = next.catch(() => undefined);
      return next;
    },
    close() {
      // Nothing to release.
    },
  };
}

export function createMemoryStorage(options: MemoryOptions = {}): Storage {
  const { beforeWrite, ...storageOptions } = options;
  return createStorage(createMemoryBackend(beforeWrite), storageOptions);
}
