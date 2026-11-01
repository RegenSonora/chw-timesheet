// Data format versions and upgrades (CLAUDE.md rule 7).
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { request } from '../../src/storage/idb';
import { openIdbStorage } from '../../src/storage/idb-storage';
import { DATA_VERSION, STORES_V1 } from '../../src/storage/records';
import type { StoredRecord } from '../../src/storage/types';
import { runUpgrades, SCHEMA, type Schema, type Snapshot } from '../../src/storage/upgrades';
import { must, sampleEntries } from '../core/fixtures/wireframe-sample';
import { NOW, profile, testIds } from './helpers';

const NAME = 'upgrade-test';

async function open(factory: IDBFactory, schema: Schema = SCHEMA) {
  return openIdbStorage(NAME, { indexedDB: factory, schema, now: () => NOW, newId: testIds() });
}

/** Open the raw database (no upgrade) and read every store. */
async function rawDump(factory: IDBFactory): Promise<{ version: number; data: Snapshot }> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(NAME);
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('open failed'));
    };
  });
  const data: Snapshot = {};
  const names = [...db.objectStoreNames];
  if (names.length) {
    const tx = db.transaction(names, 'readonly');
    for (const name of names) {
      data[name] = (await request(tx.objectStore(name).getAll())) as Snapshot[string];
    }
  }
  const version = db.version;
  db.close();
  return { version, data };
}

/** A made-up v0 layout: one `timesheet` store of entries, a bare `me` store. */
async function writeFakeV0(factory: IDBFactory) {
  await new Promise<void>((resolve, reject) => {
    const req = factory.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('timesheet', { keyPath: 'id' });
      db.createObjectStore('me', { keyPath: 'id' });
      const tx = must(req.transaction ?? undefined);
      for (const e of sampleEntries.slice(0, 2)) {
        // v0 had no custom counts.
        const counts: Partial<typeof e.counts> = { ...e.counts };
        delete counts.other;
        tx.objectStore('timesheet').put({ ...e, counts });
      }
      tx.objectStore('me').put({ id: 'me', name: 'Carmen Cruz', initials: 'cc' });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => {
      reject(req.error ?? new Error('open failed'));
    };
  });
}

/** v0 → v1 for the made-up layout above. */
const fakeV0Schema = (step: Schema['steps'][number]): Schema => ({
  version: 2,
  layouts: { 1: ['timesheet', 'me'], 2: STORES_V1 },
  steps: { 1: step },
});

const fakeV0Step = (snap: Snapshot): Snapshot => {
  const me = snap['me']?.[0] as { name: string; initials: string } | undefined;
  return {
    entries: (snap['timesheet'] ?? []).map((e) => {
      const entry = e as StoredRecord & { counts: object };
      return { ...entry, counts: { ...entry.counts, other: [] } };
    }),
    profile: me
      ? [
          {
            id: 'profile-1',
            created_at: NOW,
            updated_at: NOW,
            name: me.name,
            initials: me.initials.toUpperCase(),
            mailing_address: '',
            logo: null,
          } as Snapshot[string][number],
        ]
      : [],
  };
};

describe('data format version 1', () => {
  it('is what this release writes', () => {
    expect(DATA_VERSION).toBe(1);
    expect(SCHEMA.version).toBe(DATA_VERSION);
    expect(SCHEMA.layouts[DATA_VERSION]).toEqual(STORES_V1);
  });

  it('a new phone gets every v1 store and a meta record with the version', async () => {
    const factory = new IDBFactory();
    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    opened.storage.close();
    const { version, data } = await rawDump(factory);
    expect(version).toBe(1);
    expect(Object.keys(data).sort()).toEqual([...STORES_V1].sort());
    expect(data['meta']).toEqual([
      { id: 'data', data_version: 1, created_at: NOW, updated_at: NOW },
    ]);
  });

  it('keeps data across reopening', async () => {
    const factory = new IDBFactory();
    const first = await open(factory);
    if (!first.ok) throw new Error(first.reason);
    await first.storage.saveProfile({ ...profile });
    first.storage.close();
    const second = await open(factory);
    if (!second.ok) throw new Error(second.reason);
    expect(await second.storage.getProfile()).toEqual(profile);
    second.storage.close();
  });

  it('stores singletons with a UUID and timestamps', async () => {
    const factory = new IDBFactory();
    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    await opened.storage.saveProfile({ ...profile });
    await opened.storage.saveProfile({ ...profile, name: 'C. Cruz' });
    opened.storage.close();
    const stored = must((await rawDump(factory)).data['profile']);
    expect(stored).toHaveLength(1);
    const record = must(stored[0]) as { id: unknown; created_at: unknown; updated_at: unknown };
    expect(typeof record.id).toBe('string');
    expect(record.created_at).toBe(NOW);
    expect(record.updated_at).toBe(NOW);
  });
});

describe('runUpgrades', () => {
  it('runs each step in order on a copy', () => {
    const before: Snapshot = { a: [{ id: '1' }] };
    const after = runUpgrades(before, 0, 2, {
      0: (s) => ({ b: s['a'] ?? [] }),
      1: (s) => ({ c: [...(s['b'] ?? []), { id: '2' }] }),
    });
    expect(after).toEqual({ c: [{ id: '1' }, { id: '2' }] });
    expect(before).toEqual({ a: [{ id: '1' }] });
  });

  it('refuses a gap in the steps', () => {
    expect(() => runUpgrades({}, 0, 2, { 0: (s) => s })).toThrow(/No upgrade from data version 1/);
  });
});

describe('upgrading stored data', () => {
  it('a fake v0 database upgrades step by step', async () => {
    const factory = new IDBFactory();
    await writeFakeV0(factory);
    const opened = await open(factory, fakeV0Schema(fakeV0Step));
    if (!opened.ok) throw new Error(opened.reason);
    const entries = await opened.storage.listEntries();
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => Array.isArray(e.counts.other))).toBe(true);
    expect(await opened.storage.getProfile()).toEqual({ ...profile, initials: 'CC' });
    opened.storage.close();

    const { version, data } = await rawDump(factory);
    expect(version).toBe(2);
    expect(Object.keys(data).sort()).toEqual([...STORES_V1].sort());
    expect(must(data['meta'])[0]).toMatchObject({ data_version: 2 });
  });

  it('the current v1 layout upgrades to a fake v2 and keeps its records', async () => {
    const factory = new IDBFactory();
    const v1 = await open(factory);
    if (!v1.ok) throw new Error(v1.reason);
    await v1.storage.saveProfile({ ...profile });
    for (const e of sampleEntries) await v1.storage.saveEntry(e);
    v1.storage.close();

    const v2: Schema = {
      version: 2,
      layouts: { 1: STORES_V1, 2: STORES_V1 },
      steps: {
        1: (s) => ({
          ...s,
          entries: (s['entries'] ?? []).map((e) => ({
            ...e,
            notes: `v2:${(e as StoredRecord & { notes: string }).notes}`,
          })),
        }),
      },
    };
    const opened = await open(factory, v2);
    if (!opened.ok) throw new Error(opened.reason);
    const entries = await opened.storage.listEntries();
    expect(entries).toHaveLength(sampleEntries.length);
    expect(entries.every((e) => e.notes.startsWith('v2:'))).toBe(true);
    expect(await opened.storage.getProfile()).toEqual(profile);
    opened.storage.close();

    const meta = must(must((await rawDump(factory)).data['meta'])[0]);
    expect(meta).toMatchObject({ data_version: 2, created_at: NOW });
  });

  it('a failed upgrade leaves the old data and version untouched', async () => {
    const factory = new IDBFactory();
    await writeFakeV0(factory);
    const before = await rawDump(factory);

    const opened = await open(
      factory,
      fakeV0Schema(() => {
        throw new Error('bad step');
      }),
    );
    expect(opened).toMatchObject({ ok: false, reason: 'upgrade_failed' });
    expect(await rawDump(factory)).toEqual(before);

    // The next release with a working step still upgrades it.
    const fixed = await open(factory, fakeV0Schema(fakeV0Step));
    expect(fixed.ok).toBe(true);
    if (fixed.ok) fixed.storage.close();
  });

  it('a missing upgrade step fails without touching data', async () => {
    const factory = new IDBFactory();
    await writeFakeV0(factory);
    const before = await rawDump(factory);
    const opened = await open(factory, { version: 3, layouts: { 3: STORES_V1 }, steps: {} });
    expect(opened).toMatchObject({ ok: false, reason: 'upgrade_failed' });
    expect(await rawDump(factory)).toEqual(before);
  });

  it('data from a newer app version is refused, never rewritten', async () => {
    const factory = new IDBFactory();
    const newer: Schema = { version: 5, layouts: { 5: STORES_V1 }, steps: {} };
    const n = await open(factory, newer);
    if (!n.ok) throw new Error(n.reason);
    await n.storage.saveProfile({ ...profile });
    n.storage.close();
    const before = await rawDump(factory);

    expect(await open(factory)).toMatchObject({ ok: false, reason: 'newer_data' });
    expect(await rawDump(factory)).toEqual(before);
  });
});
