// Data format versions and upgrades (CLAUDE.md rule 7).
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { verifyFingerprint } from '../../src/core/fingerprint';
import type { Entry, Invoice } from '../../src/core/types';
import { request } from '../../src/storage/idb';
import { openIdbStorage } from '../../src/storage/idb-storage';
import { DATA_VERSION, STORES_V1 } from '../../src/storage/records';
import type { StoredRecord } from '../../src/storage/types';
import { emptyAppState } from '../../src/storage/storage';
import {
  runUpgrades,
  SCHEMA,
  v1ToV2,
  v2ToV3,
  type Schema,
  type Snapshot,
} from '../../src/storage/upgrades';
import { must, sampleEntries } from '../core/fixtures/wireframe-sample';
import goldenV1 from '../core/golden/fingerprint-v1.json';
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

/** The layout the first release (data v1) wrote, with no upgrade steps. */
const releasedV1: Schema = { version: 1, layouts: { 1: STORES_V1 }, steps: {} };

/** What releases up to 0.10.0 (data v2) wrote and ran. */
const releasedV2: Schema = {
  version: 2,
  layouts: { 1: STORES_V1, 2: STORES_V1 },
  steps: { 1: v1ToV2 },
};

/** Put records straight into a store, as an older release would have written them. */
async function rawPut(factory: IDBFactory, store: string, records: unknown[]) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(NAME);
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('open failed'));
    };
  });
  const tx = db.transaction([store], 'readwrite');
  for (const r of records) tx.objectStore(store).put(r);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('write failed'));
    };
  });
  db.close();
}

/** An entry as data v2 stored it: one `task_id`. */
function v2Entry(e: Entry) {
  const copy: Record<string, unknown> = { ...e, task_id: must(e.tasks[0]).task_id };
  delete copy['tasks'];
  return copy;
}

const byStart = (entries: readonly Entry[]) =>
  [...entries].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

describe('data format version 3', () => {
  it('is what this release writes', () => {
    expect(DATA_VERSION).toBe(3);
    expect(SCHEMA.version).toBe(DATA_VERSION);
    expect(SCHEMA.layouts[DATA_VERSION]).toEqual(STORES_V1);
  });

  it('a new phone gets every store and a meta record with the version', async () => {
    const factory = new IDBFactory();
    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    opened.storage.close();
    const { version, data } = await rawDump(factory);
    expect(version).toBe(3);
    expect(Object.keys(data).sort()).toEqual([...STORES_V1].sort());
    expect(data['meta']).toEqual([
      { id: 'data', data_version: 3, created_at: NOW, updated_at: NOW },
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

  it('the current layout upgrades to a fake v4 and keeps its records', async () => {
    const factory = new IDBFactory();
    const current = await open(factory);
    if (!current.ok) throw new Error(current.reason);
    await current.storage.saveProfile({ ...profile });
    for (const e of sampleEntries) await current.storage.saveEntry(e);
    current.storage.close();

    const v4: Schema = {
      version: 4,
      layouts: { 3: STORES_V1, 4: STORES_V1 },
      steps: {
        3: (s) => ({
          ...s,
          entries: (s['entries'] ?? []).map((e) => ({
            ...e,
            notes: `v4:${(e as StoredRecord & { notes: string }).notes}`,
          })),
        }),
      },
    };
    const opened = await open(factory, v4);
    if (!opened.ok) throw new Error(opened.reason);
    const entries = await opened.storage.listEntries();
    expect(entries).toHaveLength(sampleEntries.length);
    expect(entries.every((e) => e.notes.startsWith('v4:'))).toBe(true);
    expect(await opened.storage.getProfile()).toEqual(profile);
    opened.storage.close();

    const meta = must(must((await rawDump(factory)).data['meta'])[0]);
    expect(meta).toMatchObject({ data_version: 4, created_at: NOW });
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

describe('v1 → v2: app state gains draft', () => {
  const v1State = {
    running_timer: { start: NOW, source_id: 'tisupp' },
    selected_source_id: 'tisupp',
    per_source: { tisupp: { last_budget_line_id: 'chw-referrals', recent_task_ids: ['outreach'] } },
  };

  it('the step adds an empty draft and changes nothing else', () => {
    const record = { id: 'state-1', created_at: NOW, updated_at: NOW, ...v1State };
    const entry = { id: 'e1' };
    expect(v1ToV2({ app_state: [record], entries: [entry] })).toEqual({
      app_state: [{ ...record, draft: null }],
      entries: [entry],
    });
    expect(v1ToV2({ entries: [] })).toEqual({ entries: [], app_state: [] });
  });

  it('a phone with released v1 data opens with every record kept', async () => {
    const factory = new IDBFactory();
    const v1 = await open(factory, releasedV1);
    if (!v1.ok) throw new Error(v1.reason);
    await v1.storage.saveProfile({ ...profile });
    for (const e of sampleEntries) await v1.storage.saveEntry(v2Entry(e) as unknown as Entry);
    // The v1 app state had no draft field.
    await v1.storage.saveAppState(v1State as unknown as ReturnType<typeof emptyAppState>);
    v1.storage.close();
    expect((await rawDump(factory)).version).toBe(1);

    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    expect(await opened.storage.getAppState()).toEqual({ ...v1State, draft: null });
    expect(await opened.storage.listEntries()).toEqual(byStart(sampleEntries));
    expect(await opened.storage.getProfile()).toEqual(profile);
    opened.storage.close();

    const { version, data } = await rawDump(factory);
    expect(version).toBe(3);
    expect(must(data['meta'])[0]).toMatchObject({ data_version: 3 });
  });

  it('a phone with no v1 app state upgrades cleanly', async () => {
    const factory = new IDBFactory();
    const v1 = await open(factory, releasedV1);
    if (!v1.ok) throw new Error(v1.reason);
    v1.storage.close();
    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    expect(await opened.storage.getAppState()).toEqual(emptyAppState());
    opened.storage.close();
  });
});

describe('v2 → v3: one task becomes a list of task shares (decision 0024)', () => {
  const oldInvoice = must(goldenV1[0]).invoice as unknown as StoredRecord;

  it('gives each entry one share holding all its billed hours', () => {
    const e = must(sampleEntries[0]); // 9:12:04–10:37:10, 1.50 h
    const after = v2ToV3({ entries: [v2Entry(e) as unknown as StoredRecord] });
    expect(after['entries']).toEqual([e]);
    expect(must(after['entries'])[0]).toMatchObject({
      tasks: [{ task_id: 'client-check-in', quarters: 6 }],
    });
  });

  it('turns frozen invoice entries into one share and they still verify', async () => {
    const after = must(v2ToV3({ invoices: [oldInvoice] })['invoices']?.[0]) as unknown as Invoice;
    expect(after.entries.every((e) => e.tasks.length === 1 && !('task_id' in e))).toBe(true);
    expect(after.canonical_version).toBe(1);
    expect(await verifyFingerprint(after)).toBe(true);
  });

  it('turns an entry draft pick into a share filled in at save, and leaves setup drafts', () => {
    const base = { id: 's', created_at: NOW, updated_at: NOW, per_source: {}, running_timer: null };
    const entryDraft = { kind: 'entry', task_id: 'outreach', notes: 'x' };
    const after = v2ToV3({
      app_state: [
        { ...base, draft: entryDraft },
        { ...base, id: 't', draft: { ...entryDraft, task_id: null } },
        { ...base, id: 'u', draft: { kind: 'setup', name: 'C' } },
        { ...base, id: 'v', draft: null },
      ] as unknown as StoredRecord[],
    });
    expect(after['app_state']?.map((r) => (r as unknown as { draft: unknown }).draft)).toEqual([
      { kind: 'entry', tasks: [{ task_id: 'outreach', quarters: 0 }], notes: 'x' },
      { kind: 'entry', tasks: [], notes: 'x' },
      { kind: 'setup', name: 'C' },
      null,
    ]);
  });

  it('a phone with released v2 data opens with entries and invoices upgraded', async () => {
    const factory = new IDBFactory();
    const v2 = await open(factory, releasedV2);
    if (!v2.ok) throw new Error(v2.reason);
    v2.storage.close();
    await rawPut(factory, 'entries', sampleEntries.map(v2Entry));
    await rawPut(factory, 'invoices', [oldInvoice]);

    const opened = await open(factory);
    if (!opened.ok) throw new Error(opened.reason);
    expect(await opened.storage.listEntries()).toEqual(byStart(sampleEntries));
    const [invoice] = await opened.storage.listInvoices();
    expect(await verifyFingerprint(must(invoice))).toBe(true);
    opened.storage.close();
    expect((await rawDump(factory)).version).toBe(3);
  });

  it('a failed v2 → v3 upgrade leaves the v2 data untouched', async () => {
    const factory = new IDBFactory();
    const v2 = await open(factory, releasedV2);
    if (!v2.ok) throw new Error(v2.reason);
    v2.storage.close();
    await rawPut(factory, 'entries', sampleEntries.map(v2Entry));
    const before = await rawDump(factory);
    const broken: Schema = {
      ...SCHEMA,
      steps: {
        ...SCHEMA.steps,
        2: (s) => {
          v2ToV3(s);
          throw new Error('bad step');
        },
      },
    };
    expect(await open(factory, broken)).toMatchObject({ ok: false, reason: 'upgrade_failed' });
    expect(await rawDump(factory)).toEqual(before);
  });
});
