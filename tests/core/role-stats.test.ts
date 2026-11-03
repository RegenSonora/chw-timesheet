// Raise reminder, certification and My stats by role (roles plan R2; decisions 0030, 0032).
import { describe, expect, it } from 'vitest';
import { certificationStatus, myStats, raiseStatus } from '../../src/core/role-stats';
import type { FundingSourceConfig, Role, RolesFile } from '../../src/core/types';
import shipped from '../../src/roles/roles.json';
import { counts, must, priorInvoice, regen, tisupp } from './fixtures/wireframe-sample';

const file = shipped as RolesFile;
const role = (id: string) => must(file.roles.find((r) => r.id === id));
const trainee = role('chw-tc01');
const lead = role('r-tl01');
const traineeTisupp = must(trainee.funding[0]);
const leadRegen = must(lead.funding[0]);

/** An invoice of `hours` hours (priorInvoice takes cents at $20/h). */
const billed = (n: number, hours: number, from: FundingSourceConfig = tisupp, c = counts()) =>
  priorInvoice(n, hours * 2000, c, from);

describe('raiseStatus (decision 0030)', () => {
  it('is null for a funding entry with no raise', () => {
    expect(raiseStatus(leadRegen, 2200, [billed(1, 500, regen)], 0)).toBeNull();
  });

  it('is null under 240 hours, billed plus waiting', () => {
    expect(raiseStatus(traineeTisupp, 2000, [billed(1, 200)], 159)).toBeNull();
  });

  it('asks to invoice first while the hours reaching 240 are still waiting', () => {
    expect(raiseStatus(traineeTisupp, 2000, [billed(1, 200)], 160)).toEqual({
      invoice_first: true,
      after_quarters: 960,
      rate_cents: 2300,
    });
  });

  it('asks only for the rate change once 240 hours are invoiced', () => {
    expect(raiseStatus(traineeTisupp, 2000, [billed(1, 240)], 0)).toEqual({
      invoice_first: false,
      after_quarters: 960,
      rate_cents: 2300,
    });
  });

  it('is null once the rate is $23.00 or more, or not set', () => {
    expect(raiseStatus(traineeTisupp, 2300, [billed(1, 300)], 0)).toBeNull();
    expect(raiseStatus(traineeTisupp, 2500, [billed(1, 300)], 0)).toBeNull();
    expect(raiseStatus(traineeTisupp, null, [billed(1, 300)], 0)).toBeNull();
  });

  it("counts only this source's invoices", () => {
    expect(raiseStatus(traineeTisupp, 2000, [billed(1, 239), billed(2, 50, regen)], 0)).toBeNull();
  });
});

describe('certificationStatus (decision 0032)', () => {
  it('is null for a role with no certification step', () => {
    expect(certificationStatus(lead, 5000)).toBeNull();
  });

  it('counts down to 480 hours', () => {
    expect(certificationStatus(trainee, 1919)).toEqual({
      state: 'counting',
      left_quarters: 1,
      after_quarters: 1920,
      name: 'CHW Cert',
    });
  });

  it('is eligible at exactly 480 hours', () => {
    expect(certificationStatus(trainee, 1920)).toEqual({
      state: 'eligible',
      after_quarters: 1920,
      name: 'CHW Cert',
    });
  });
});

describe('myStats (decision 0032)', () => {
  it('adds invoiced hours across every source', () => {
    const both: Role = { ...trainee, funding: [traineeTisupp, leadRegen] };
    const stats = myStats(
      file.counts,
      both,
      { tisupp: 2000, 'regen-general-operating': 2200 },
      [billed(1, 100), billed(2, 50, regen)],
      12,
    );
    expect(stats.invoiced_quarters).toBe(600);
    expect(stats.waiting_quarters).toBe(12);
    // The raise still counts TISUPP hours only.
    expect(stats.pay).toEqual({
      state: 'counting',
      left_quarters: 560,
      after_quarters: 960,
      rate_cents: 2300,
    });
    // Certification counts the role's hours on every source.
    expect(stats.certification).toEqual({
      state: 'counting',
      left_quarters: 1320,
      after_quarters: 1920,
      name: 'CHW Cert',
    });
  });

  it('shows the raise as reached until the rate is changed, then drops it', () => {
    const invoices = [billed(1, 240)];
    expect(myStats(file.counts, trainee, { tisupp: 2000 }, invoices, 0).pay).toEqual({
      state: 'reached',
      after_quarters: 960,
      rate_cents: 2300,
    });
    expect(myStats(file.counts, trainee, { tisupp: 2300 }, invoices, 0).pay).toBeNull();
  });

  it('has no raise or certification row for the Team Lead', () => {
    const stats = myStats(file.counts, lead, { 'regen-general-operating': 2200 }, [], 0);
    expect(stats.pay).toBeNull();
    expect(stats.certification).toBeNull();
  });

  it("totals the role's counts above 0 in list order, leaving out extra counts", () => {
    const stats = myStats(
      file.counts,
      trainee,
      { tisupp: 2000 },
      [
        billed(1, 10, tisupp, counts({ contacts: 4, rides_provided: 1 })),
        billed(2, 10, tisupp, counts({ contacts: 2, other: [{ label: 'Flyers', value: 5 }] })),
      ],
      0,
    );
    expect(stats.counts).toEqual([
      { id: 'contacts', label: 'Contacts', unit: null, total: 6 },
      { id: 'rides_provided', label: 'Rides provided', unit: null, total: 1 },
    ]);
    expect(stats).not.toHaveProperty('other');
  });

  it("lists nothing before a count has a total, and keeps the Team Lead's units", () => {
    expect(myStats(file.counts, lead, {}, [], 0).counts).toEqual([]);
    const stats = myStats(
      file.counts,
      lead,
      {},
      [billed(1, 4, regen, counts({}, { grow_space_added: 40, trees_planted: 3 }))],
      0,
    );
    expect(stats.counts).toEqual([
      { id: 'trees_planted', label: 'Trees planted', unit: null, total: 3 },
      { id: 'grow_space_added', label: 'Grow space added', unit: 'sq ft', total: 40 },
    ]);
  });

  it('leaves out a count the role does not use, even with a total', () => {
    const stats = myStats(file.counts, lead, {}, [billed(1, 4, regen, counts({ contacts: 5 }))], 0);
    expect(stats.counts).toEqual([]);
  });
});
