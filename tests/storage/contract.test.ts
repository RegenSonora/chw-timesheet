// The Storage contract, run on the in-memory and IndexedDB adapters alike.
import { describe, expect, it } from 'vitest';
import { emptyCounts } from '../../src/core/counts';
import { verifyFingerprint } from '../../src/core/fingerprint';
import type { Entry } from '../../src/core/types';
import { emptyAppState, rememberPicks } from '../../src/storage/storage';
import { RECENT_TASKS_MAX, type AppState, type Storage } from '../../src/storage/types';
import {
  makeEntry,
  must,
  regen,
  sampleEntries,
  tisupp,
  uuid,
} from '../core/fixtures/wireframe-sample';
import { adapters, NOW, profile, seedSample } from './helpers';

const generate = (storage: Storage) =>
  storage.generateInvoice({ source: tisupp, now: NOW, invoice_date: '2026-10-31' });

async function generated(storage: Storage) {
  const result = await generate(storage);
  if (!result.ok) throw new Error(`generate failed: ${result.reason}`);
  return result;
}

/** Nothing changed: no invoice, no entry locked, counter as seeded. */
async function expectUntouched(storage: Storage) {
  expect(await storage.listInvoices()).toEqual([]);
  expect((await storage.listEntries()).every((e) => e.invoice_id === null)).toBe(true);
  expect(await storage.getCounter()).toEqual({ next: 4, locked: false });
}

describe.each(adapters)('$name adapter', (adapter) => {
  describe('profile and settings (SPEC §4)', () => {
    it('starts empty and keeps one profile', async () => {
      const storage = await adapter.make();
      expect(await storage.getProfile()).toBeNull();
      await storage.saveProfile({ ...profile });
      await storage.saveProfile({ ...profile, mailing_address: 'PO Box 1' });
      expect(await storage.getProfile()).toEqual({ ...profile, mailing_address: 'PO Box 1' });
      storage.close();
    });

    it('keeps one settings record per source', async () => {
      const storage = await adapter.make();
      expect(await storage.getSourceSettings('tisupp')).toBeNull();
      await storage.saveSourceSettings({ source_id: 'tisupp', rate_cents: 2000, nte_cents: null });
      await storage.saveSourceSettings({ source_id: regen.id, rate_cents: 2237, nte_cents: null });
      await storage.saveSourceSettings({ source_id: 'tisupp', rate_cents: 2100, nte_cents: 9900 });
      expect(await storage.getSourceSettings('tisupp')).toEqual({
        source_id: 'tisupp',
        rate_cents: 2100,
        nte_cents: 9900,
      });
      expect(await storage.listSourceSettings()).toHaveLength(2);
      storage.close();
    });
  });

  describe('entries (SPEC §5)', () => {
    it('saves, edits, lists oldest first and deletes', async () => {
      const storage = await adapter.make();
      for (const entry of sampleEntries)
        expect(await storage.saveEntry(entry)).toEqual({ ok: true });
      const list = await storage.listEntries();
      expect(list.map((e) => e.entry_date)).toEqual(
        [...sampleEntries].reverse().map((e) => e.entry_date),
      );

      const first = must(list[0]);
      expect(await storage.saveEntry({ ...first, notes: 'Edited' })).toEqual({ ok: true });
      expect((await storage.getEntry(first.id))?.notes).toBe('Edited');

      expect(await storage.deleteEntry(first.id)).toEqual({ ok: true });
      expect(await storage.getEntry(first.id)).toBeNull();
      expect(await storage.deleteEntry(first.id)).toEqual({ ok: false, reason: 'not_found' });
      storage.close();
    });

    it('returns copies, not live records', async () => {
      const storage = await adapter.make();
      const entry = must(sampleEntries[0]);
      await storage.saveEntry(entry);
      const read = must((await storage.getEntry(entry.id)) ?? undefined);
      read.notes = 'changed in memory';
      expect((await storage.getEntry(entry.id))?.notes).toBe(entry.notes);
      storage.close();
    });

    it('refuses an entry that arrives already invoiced (only generateInvoice locks)', async () => {
      const storage = await adapter.make();
      const entry: Entry = { ...must(sampleEntries[0]), invoice_id: uuid(1) };
      expect(await storage.saveEntry(entry)).toEqual({ ok: false, reason: 'invoice_id_set' });
      expect(await storage.getEntry(entry.id)).toBeNull();
      storage.close();
    });
  });

  describe('counter (SPEC §6, decision 0005)', () => {
    it('starts at 1 and takes a starting number until the first invoice', async () => {
      const storage = await adapter.make();
      expect(await storage.getCounter()).toEqual({ next: 1, locked: false });
      expect(await storage.setNextNumber(0)).toEqual({ ok: false, reason: 'invalid' });
      expect(await storage.setNextNumber(4)).toEqual({
        ok: true,
        counter: { next: 4, locked: false },
      });
      expect(await storage.getCounter()).toEqual({ next: 4, locked: false });
      storage.close();
    });
  });

  describe('app state (SPEC §5)', () => {
    it('remembers a running timer and per-source picks', async () => {
      const storage = await adapter.make();
      expect(await storage.getAppState()).toEqual(emptyAppState());
      const state = rememberPicks(
        { ...emptyAppState(), running_timer: { start: NOW, source_id: 'tisupp' } },
        'tisupp',
        'outreach',
        'outreach-and-marketing',
      );
      await storage.saveAppState(state);
      expect(await storage.getAppState()).toEqual(state);
      storage.close();
    });

    it('keeps a half-entered entry draft (SPEC §10)', async () => {
      const storage = await adapter.make();
      const state: AppState = {
        ...emptyAppState(),
        draft: {
          kind: 'entry',
          entry_id: null,
          step: 'counts',
          hand: null,
          start: '2026-10-30T09:12:04-07:00',
          stop: '2026-10-30T10:37:10-07:00',
          source_id: 'tisupp',
          task_id: 'client-check-in',
          budget_line_id: 'chw-referrals',
          counts: { ...emptyCounts(), contacts: 1, other: [{ label: 'Food boxes', value: 2 }] },
          notes: 'Library',
        },
      };
      await storage.saveAppState(structuredClone(state));
      expect(await storage.getAppState()).toEqual(state);
      storage.close();
    });
  });

  describe('generateInvoice (SPEC §6, CLAUDE.md rule 5)', () => {
    it('creates CC-2026-004 for $185.00, locks the 8 entries and advances the counter', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      const { invoice, entry_ids } = await generated(storage);

      expect(invoice.number).toBe('CC-2026-004');
      expect(invoice.total_cents).toBe(18_500);
      expect(entry_ids).toHaveLength(8);
      expect(await verifyFingerprint(invoice)).toBe(true);

      expect(await storage.getInvoice(invoice.id)).toEqual(invoice);
      expect(await storage.listInvoices()).toEqual([invoice]);
      expect(await storage.getCounter()).toEqual({ next: 5, locked: true });
      const entries = await storage.listEntries();
      expect(entries.every((e) => e.invoice_id === invoice.id && e.updated_at === NOW)).toBe(true);
      storage.close();
    });

    it('re-reads a stored invoice that still verifies (re-share)', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      const { invoice } = await generated(storage);
      expect(
        await verifyFingerprint(must((await storage.getInvoice(invoice.id)) ?? undefined)),
      ).toBe(true);
      storage.close();
    });

    it('locked entries refuse edits and deletes at the storage layer', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      await generated(storage);
      const locked = must((await storage.listEntries())[0]);
      expect(await storage.saveEntry({ ...locked, notes: 'x' })).toEqual({
        ok: false,
        reason: 'invoice_id_set',
      });
      expect(await storage.saveEntry({ ...locked, invoice_id: null, notes: 'x' })).toEqual({
        ok: false,
        reason: 'locked',
      });
      expect(await storage.deleteEntry(locked.id)).toEqual({ ok: false, reason: 'locked' });
      expect(await storage.getEntry(locked.id)).toEqual(locked);
      storage.close();
    });

    it('locks the starting number after the first invoice', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      await generated(storage);
      expect(await storage.setNextNumber(1)).toEqual({ ok: false, reason: 'locked' });
      expect(await storage.getCounter()).toEqual({ next: 5, locked: true });
      storage.close();
    });

    it('bills only the chosen source and shares one counter across sources', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      await storage.saveSourceSettings({ source_id: regen.id, rate_cents: 2237, nte_cents: null });
      const regenTask = must(regen.tasks[0]).id;
      const regenLine = must(regen.budget_lines[0]).id;
      const other = makeEntry('2026-10-31', '08:00:00', '09:00:00', regenTask, regenLine, {
        source_id: regen.id,
      });
      await storage.saveEntry(other);

      await generated(storage);
      expect((await storage.getEntry(other.id))?.invoice_id).toBeNull();

      const second = await storage.generateInvoice({
        source: regen,
        now: NOW,
        invoice_date: '2026-10-31',
      });
      if (!second.ok) throw new Error(second.reason);
      expect(second.invoice.number).toBe('CC-2026-005');
      expect(second.invoice.total_cents).toBe(2237);
      expect(await storage.getCounter()).toEqual({ next: 6, locked: true });
      storage.close();
    });

    it('has nothing to bill twice', async () => {
      const storage = await adapter.make();
      await seedSample(storage);
      await generated(storage);
      expect(await generate(storage)).toEqual({ ok: false, reason: 'no_entries' });
      storage.close();
    });

    it('needs a profile and a rate', async () => {
      const storage = await adapter.make();
      expect(await generate(storage)).toEqual({ ok: false, reason: 'no_profile' });
      await storage.saveProfile({ ...profile });
      expect(await generate(storage)).toEqual({ ok: false, reason: 'no_rate' });
      storage.close();
    });

    it('saves nothing when an entry is added while the invoice is being built', async () => {
      let late: Storage | undefined;
      const extra = makeEntry(
        '2026-10-31',
        '08:00:00',
        '09:00:00',
        'outreach',
        'outreach-and-marketing',
      );
      const storage = await adapter.make({
        generateHooks: {
          async beforeWrite() {
            if (!late) return;
            const s = late;
            late = undefined;
            await s.saveEntry(extra);
          },
        },
      });
      late = storage;
      await seedSample(storage);
      expect(await generate(storage)).toEqual({ ok: false, reason: 'changed' });
      await expectUntouched(storage);

      // Trying again includes the new entry.
      const { invoice } = await generated(storage);
      expect(invoice.number).toBe('CC-2026-004');
      expect(invoice.entries).toHaveLength(9);
      storage.close();
    });

    it('saves nothing when the counter moves while the invoice is being built', async () => {
      let late: Storage | undefined;
      const storage = await adapter.make({
        generateHooks: {
          async beforeWrite() {
            if (!late) return;
            const s = late;
            late = undefined;
            await s.setNextNumber(7);
          },
        },
      });
      late = storage;
      await seedSample(storage);
      expect(await generate(storage)).toEqual({ ok: false, reason: 'changed' });
      expect(await storage.listInvoices()).toEqual([]);
      expect((await generated(storage)).invoice.number).toBe('CC-2026-007');
      storage.close();
    });

    // Writes in generateInvoice: 8 entries, then the invoice (9th), then the counter (10th).
    describe.each([
      { at: 1, how: 'throw' },
      { at: 5, how: 'throw' },
      { at: 9, how: 'throw' },
      { at: 10, how: 'throw' },
      { at: 1, how: 'abort' },
      { at: 9, how: 'abort' },
      { at: 10, how: 'abort' },
    ] as const)('interrupted at write $at ($how)', ({ at, how }) => {
      it('leaves nothing half-done, and a retry gets the same number', async () => {
        let armed = false;
        let writes = 0;
        const storage = await adapter.make({
          beforeWrite(_store, abort) {
            if (!armed) return;
            if (++writes !== at) return;
            armed = false;
            if (how === 'throw') throw new Error('phone died');
            abort();
          },
        });
        await seedSample(storage);
        armed = true;
        await expect(generate(storage)).rejects.toThrow();
        await expectUntouched(storage);

        const { invoice } = await generated(storage);
        expect(invoice.number).toBe('CC-2026-004');
        expect(await storage.getCounter()).toEqual({ next: 5, locked: true });
        storage.close();
      });
    });
  });
});

describe('rememberPicks (SPEC §5)', () => {
  it('moves the task to the front, keeps the budget line and caps the list', () => {
    let state = emptyAppState();
    for (let i = 0; i < RECENT_TASKS_MAX + 3; i++)
      state = rememberPicks(state, 's', `t${String(i)}`, 'b1');
    state = rememberPicks(state, 's', 't5', 'b2');
    const picks = must(state.per_source['s']);
    expect(picks.last_budget_line_id).toBe('b2');
    expect(picks.recent_task_ids[0]).toBe('t5');
    expect(picks.recent_task_ids).toHaveLength(RECENT_TASKS_MAX);
    expect(new Set(picks.recent_task_ids).size).toBe(RECENT_TASKS_MAX);
  });

  it('keeps sources apart', () => {
    const state = rememberPicks(rememberPicks(emptyAppState(), 'a', 't1', 'b1'), 'b', 't2', 'b2');
    expect(state.per_source['a']?.recent_task_ids).toEqual(['t1']);
    expect(state.per_source['b']?.last_budget_line_id).toBe('b2');
  });
});
