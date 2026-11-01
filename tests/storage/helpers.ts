// Both adapters behind one factory, so every contract test runs on each.
import { IDBFactory } from 'fake-indexeddb';
import { openIdbStorage } from '../../src/storage/idb-storage';
import { createMemoryStorage } from '../../src/storage/memory-storage';
import type { StorageOptions } from '../../src/storage/storage';
import type { BeforeWrite, Storage } from '../../src/storage/types';
import { sampleEntries, uuid } from '../core/fixtures/wireframe-sample';

export interface AdapterOptions extends StorageOptions {
  beforeWrite?: BeforeWrite;
}

export interface Adapter {
  name: string;
  make(options?: AdapterOptions): Promise<Storage>;
}

export const NOW = '2026-10-31T16:00:00-07:00';

export function testIds(): () => string {
  let n = 9000;
  return () => uuid(n++);
}

export const adapters: Adapter[] = [
  {
    name: 'memory',
    make: (options = {}) =>
      Promise.resolve(createMemoryStorage({ now: () => NOW, newId: testIds(), ...options })),
  },
  {
    name: 'indexeddb',
    async make(options = {}) {
      const opened = await openIdbStorage('test', {
        indexedDB: new IDBFactory(),
        now: () => NOW,
        newId: testIds(),
        ...options,
      });
      if (!opened.ok) throw new Error(`open failed: ${opened.reason}`);
      return opened.storage;
    },
  },
];

export const profile = {
  name: 'Carmen Cruz',
  initials: 'CC',
  mailing_address: '',
  logo: null,
} as const;

/** The wireframe sample: profile, TISUPP at $20.00, next number 4, 8 entries. */
export async function seedSample(storage: Storage): Promise<void> {
  await storage.saveProfile({ ...profile });
  await storage.saveSourceSettings({ source_id: 'tisupp', rate_cents: 2000, nte_cents: 500_000 });
  const set = await storage.setNextNumber(4);
  if (!set.ok) throw new Error('setNextNumber failed');
  for (const entry of sampleEntries) {
    const saved = await storage.saveEntry(entry);
    if (!saved.ok) throw new Error(`saveEntry failed: ${saved.reason}`);
  }
}
