// The phone after an office change to the roles file (roles plan R7, decision 0027).
import { describe, expect, it } from 'vitest';
import type { Role } from '../../src/core/types';
import { createMemoryStorage, emptyAppState, type Storage } from '../../src/storage';
import { applyRoleUpdate, invoiceRoleFor, type Data } from '../../src/ui/store';
import { findTestRole, must, sampleEntries } from '../core/fixtures/wireframe-sample';

const lead = findTestRole('r-tl01');
const old: Role = {
  ...lead,
  id: 'r-tl00',
  code: 'R-TL00',
  name: 'Old lead',
  retired: true,
  replaced_by: 'r-tl01',
};
const regenId = 'regen-general-operating';

async function phone(roleId: string, rate: number): Promise<{ storage: Storage; data: Data }> {
  const storage = createMemoryStorage();
  const profile = {
    name: 'Carmen Cruz',
    initials: 'CC',
    mailing_address: '',
    logo: null,
    role_id: roleId,
  };
  await storage.saveProfile(profile);
  await storage.saveSourceSettings({ source_id: regenId, rate_cents: rate, nte_cents: null });
  const data: Data = {
    profile,
    settings: await storage.listSourceSettings(),
    entries: [],
    invoices: [],
    counter: await storage.getCounter(),
    app: emptyAppState(),
    persistence: 'unsupported',
  };
  return { storage, data };
}

describe('applyRoleUpdate', () => {
  it('moves a retired role to its replacement once, with a notice and the rate to check', async () => {
    const { storage, data } = await phone('r-tl00', 2000);
    const after = await applyRoleUpdate(storage, data, [old, lead]);
    expect(after.profile?.role_id).toBe('r-tl01');
    expect(after.app.role_notice).toEqual({
      from_code: 'R-TL00',
      from_name: 'Old lead',
      to_code: 'R-TL01',
      to_name: 'Resilience Team Lead',
      rate_notes: [{ source_id: regenId, rate_cents: 2200 }],
    });
    // Rates are never changed for the person.
    expect(after.settings.map((s) => s.rate_cents)).toEqual([2000]);
    expect((await storage.getProfile())?.role_id).toBe('r-tl01');
    expect((await storage.getAppState()).role_notice?.to_code).toBe('R-TL01');

    // The next open finds the current role and changes nothing.
    const again = await applyRoleUpdate(storage, after, [old, lead]);
    expect(again).toBe(after);
  });

  it('leaves an active or retired role as it is', async () => {
    const { storage, data } = await phone('r-tl01', 2200);
    expect(await applyRoleUpdate(storage, data, [old, lead])).toBe(data);
    const gone: Role = { ...lead, retired: true };
    expect(await applyRoleUpdate(storage, data, [gone])).toBe(data);
  });
});

describe('invoiceRoleFor', () => {
  it('bills the oldest waiting hours under the role they were logged with', async () => {
    const { data } = await phone('chw-tc01', 2000);
    const sorted = [...sampleEntries].sort((a, b) => (a.start < b.start ? -1 : 1));
    const entries = sorted.map((e, i) => ({ ...e, role_id: i === 0 ? 'chw-te01' : 'chw-tc01' }));
    const first = invoiceRoleFor({ ...data, entries }, 'tisupp');
    expect(first.entry_role_id).toBe('chw-te01');
    expect(first.role?.employment).toBe('employee');
    const rest = invoiceRoleFor({ ...data, entries: entries.slice(1) }, 'tisupp');
    expect(rest).toEqual({ role: findTestRole('chw-tc01'), entry_role_id: 'chw-tc01' });
    expect(invoiceRoleFor({ ...data, entries: [] }, 'tisupp').entry_role_id).toBeUndefined();
    expect(must(entries[0]).role_id).toBe('chw-te01');
  });
});
