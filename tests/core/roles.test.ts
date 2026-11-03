// Role choices, rate prefill and counts (roles plan R2; decisions 0027, 0028, 0029, 0030, 0033).
import { describe, expect, it } from 'vitest';
import {
  budgetLineChoices,
  countChoices,
  checkRolePicks,
  duplicateCountLabel,
  entryCountChoices,
  fundingChoices,
  invoiceCounts,
  prefillRate,
  resolveRole,
  roleChoices,
  roleDefaultLine,
  roleUpdate,
  taskChoices,
} from '../../src/core/roles';
import { emptyCounts } from '../../src/core/counts';
import { RECENT_TASKS_SHOWN } from '../../src/core/picks';
import type { FundingSourceConfig, Role, RoleFunding, RolesFile } from '../../src/core/types';
import shipped from '../../src/roles/roles.json';
import { must, regen, tisupp } from './fixtures/wireframe-sample';

const file = shipped as RolesFile;
const sources = [tisupp, regen];
const role = (id: string) => must(file.roles.find((r) => r.id === id));
const trainee = role('chw-tc01');
const employee = role('chw-te01');
const lead = role('r-tl01');
const funding = (r: Role, sourceId: string) =>
  must(r.funding.find((f) => f.source_id === sourceId));

describe('roleChoices', () => {
  it('lists the shipped roles in file order', () => {
    expect(roleChoices(file.roles).map((r) => r.code)).toEqual(['CHW-TC01', 'CHW-TE01', 'R-TL01']);
  });

  it('leaves out retired roles', () => {
    const retired: Role = { ...lead, id: 'r-tl00', code: 'R-TL00', retired: true };
    expect(roleChoices([retired, ...file.roles]).map((r) => r.id)).not.toContain('r-tl00');
  });
});

describe('resolveRole', () => {
  const old: Role = { ...lead, id: 'r-old', retired: true, replaced_by: 'r-mid' };
  const mid: Role = { ...lead, id: 'r-mid', retired: true, replaced_by: 'r-tl01' };
  const gone: Role = { ...lead, id: 'r-gone', retired: true };
  const roles = [...file.roles, old, mid, gone];

  it('returns an active role as it is', () => {
    expect(resolveRole(roles, 'chw-tc01')).toBe(trainee);
  });

  it('follows replaced_by through several steps', () => {
    expect(resolveRole(roles, 'r-old')).toBe(lead);
  });

  it('stops at a retired role with no replacement', () => {
    expect(resolveRole(roles, 'r-gone')).toBe(gone);
  });

  it('returns undefined for an unknown id or a broken chain', () => {
    expect(resolveRole(roles, 'nobody')).toBeUndefined();
    const broken: Role = { ...gone, id: 'r-broken', replaced_by: 'nobody' };
    expect(resolveRole([broken], 'r-broken')).toBeUndefined();
  });

  it('does not loop forever', () => {
    const a: Role = { ...gone, id: 'a', replaced_by: 'b' };
    const b: Role = { ...gone, id: 'b', replaced_by: 'a' };
    expect(resolveRole([a, b], 'a')).toBeUndefined();
  });
});

describe('fundingChoices (decision 0033)', () => {
  const ids = (r: Role, date: string) => fundingChoices(r, sources, date).map((c) => c.source.id);

  it('offers TISUPP on the first and last day of its period only', () => {
    expect(ids(trainee, '2026-09-30')).toEqual([]);
    expect(ids(trainee, '2026-10-01')).toEqual(['tisupp']);
    expect(ids(trainee, '2027-09-30')).toEqual(['tisupp']);
    expect(ids(trainee, '2027-10-01')).toEqual([]);
  });

  it('always offers a source with no period', () => {
    expect(ids(lead, '2000-01-01')).toEqual(['regen-general-operating']);
    expect(ids(lead, '2099-12-31')).toEqual(['regen-general-operating']);
  });

  it("pairs each funding entry with its source, in the role's order", () => {
    const both: Role = {
      ...lead,
      funding: [...lead.funding, funding(trainee, 'tisupp')],
    };
    const [first, second] = fundingChoices(both, sources, '2026-11-03');
    expect(first?.source).toBe(regen);
    expect(first?.funding).toBe(funding(lead, 'regen-general-operating'));
    expect(second?.source).toBe(tisupp);
  });

  it("stops at the funding entry's own end date", () => {
    const ending: Role = {
      ...trainee,
      funding: [{ ...funding(trainee, 'tisupp'), ends: '2027-06-30' }],
    };
    expect(ids(ending, '2027-06-30')).toEqual(['tisupp']);
    expect(ids(ending, '2027-07-01')).toEqual([]);
  });

  it('skips a source the release does not ship', () => {
    const odd: Role = {
      ...lead,
      funding: [{ ...funding(lead, 'regen-general-operating'), source_id: 'gone' }],
    };
    expect(ids(odd, '2026-11-03')).toEqual([]);
  });
});

describe('budgetLineChoices', () => {
  it('gives a CHW Trainee the one CHW experience hours line', () => {
    expect(budgetLineChoices(trainee, tisupp).map((l) => l.id)).toEqual(['chw-experience-hours']);
  });

  it('gives the Team Lead its five lines, keeping the display name', () => {
    const lines = budgetLineChoices(lead, regen);
    expect(lines.map((l) => l.id)).toEqual([
      'fire-risk-reduction-work',
      'maintenance-labor',
      'resilient-home-services-contracting',
      'team-development',
      'other-contractors',
    ]);
    expect(lines.at(-1)).toEqual({
      id: 'other-contractors',
      name: 'Other contractors',
      display_name: 'Other',
    });
  });

  it("is empty for a source the role doesn't bill", () => {
    expect(budgetLineChoices(lead, tisupp)).toEqual([]);
  });
});

describe('taskChoices', () => {
  it("lists the line's tasks in the role's order", () => {
    const { recent, all } = taskChoices(lead, regen, 'fire-risk-reduction-work', []);
    expect(recent).toEqual([]);
    expect(all.map((t) => t.id)).toEqual([
      'firewise-assessing',
      'residential-fuel-reduction',
      'municipal-fuel-reduction',
      'dump-runs',
    ]);
    expect(all[0]?.name).toBe('Firewise assessing');
  });

  it('gives a CHW Trainee all 21 TISUPP tasks', () => {
    expect(taskChoices(trainee, tisupp, 'chw-experience-hours', []).all).toHaveLength(21);
  });

  it(`shows at most ${String(RECENT_TASKS_SHOWN)} recent tasks from this line, once each`, () => {
    const { recent } = taskChoices(lead, regen, 'maintenance-labor', [
      'tree-planting',
      'lehr-maintenance',
      'lehr-maintenance',
      'pinal-garden-maintenance',
      'gone',
      'transport-and-supply-runs',
      'regen-lot-clean-and-maintenance',
    ]);
    expect(recent.map((t) => t.id)).toEqual([
      'lehr-maintenance',
      'pinal-garden-maintenance',
      'transport-and-supply-runs',
    ]);
  });

  it('is empty for a line the role does not have', () => {
    expect(taskChoices(lead, regen, 'chw-referrals', ['outreach'])).toEqual({
      recent: [],
      all: [],
    });
  });
});

describe('countChoices (decision 0029)', () => {
  const ids = (r: Role, source: FundingSourceConfig, line: string, tasks: string[]) =>
    countChoices(file.counts, r, source, line, tasks).map((c) => c.id);

  it("joins the checked tasks' counts in the shared list's order", () => {
    expect(
      ids(lead, regen, 'fire-risk-reduction-work', ['dump-runs', 'firewise-assessing']),
    ).toEqual(['trailer_loads_removed', 'assessments_completed']);
    expect(ids(trainee, tisupp, 'chw-experience-hours', ['advocacy', 'outreach'])).toEqual([
      'contacts',
      'referrals_given',
      'referral_followups',
      'client_goals_achieved',
      'quick_wins_provided',
      'screenings_conducted',
      'applications_approved',
    ]);
  });

  it('carries labels and units', () => {
    expect(
      countChoices(file.counts, lead, regen, 'resilient-home-services-contracting', [
        'water-harvesting',
      ]),
    ).toEqual([{ id: 'water_capacity_added', label: 'Water capacity added', unit: 'gal' }]);
  });

  it('is empty for tasks with no counts, or none checked', () => {
    expect(ids(lead, regen, 'maintenance-labor', ['pinal-garden-maintenance'])).toEqual([]);
    expect(ids(lead, regen, 'fire-risk-reduction-work', [])).toEqual([]);
  });

  it('is the same for both CHW Trainee roles', () => {
    const all = taskChoices(trainee, tisupp, 'chw-experience-hours', []).all.map((t) => t.id);
    expect(ids(employee, tisupp, 'chw-experience-hours', all)).toEqual(
      ids(trainee, tisupp, 'chw-experience-hours', all),
    );
  });
});

describe('prefillRate (decision 0030)', () => {
  const source = { ...regen, default_rate_cents: 1800 };
  const entry: RoleFunding = { ...funding(lead, 'regen-general-operating') };
  const bare: RoleFunding = { source_id: regen.id, budget_lines: entry.budget_lines };

  it("uses the funding entry's rate first", () => {
    expect(prefillRate({ ...lead, suggested_rate_cents: 2100 }, entry, source)).toBe(2200);
  });

  it("then the role's suggested rate", () => {
    expect(prefillRate({ ...lead, suggested_rate_cents: 2100 }, bare, source)).toBe(2100);
  });

  it("then the source's default rate", () => {
    expect(prefillRate(lead, bare, source)).toBe(1800);
  });

  it('is null when none is set', () => {
    expect(prefillRate(lead, bare, regen)).toBeNull();
  });

  it('gives the shipped roles $20.00, $20.00 and $22.00', () => {
    expect(prefillRate(trainee, funding(trainee, 'tisupp'), tisupp)).toBe(2000);
    expect(prefillRate(employee, funding(employee, 'tisupp'), tisupp)).toBe(2000);
    expect(prefillRate(lead, entry, regen)).toBe(2200);
  });
});

describe('duplicateCountLabel (decision 0029)', () => {
  const shown = countChoices(file.counts, lead, regen, 'resilient-home-services-contracting', [
    'tree-planting',
    'tree-removal',
  ]);

  it('finds a count typed with other letter case or spaces', () => {
    expect(duplicateCountLabel('trees  PLANTED', shown)?.id).toBe('trees_planted');
    expect(duplicateCountLabel(' Trees planted ', shown)?.id).toBe('trees_planted');
    expect(duplicateCountLabel('TreesRemoved', shown)?.id).toBe('trees_removed');
  });

  it('is null for a new label', () => {
    expect(duplicateCountLabel('Tree planted', shown)).toBeNull();
    expect(duplicateCountLabel('Contacts', shown)).toBeNull();
    expect(duplicateCountLabel('', shown)).toBeNull();
  });
});

describe('invoiceCounts (decision 0029)', () => {
  const defs = file.counts;

  it('lists only counts with a value in the period, each with its all-time total', () => {
    expect(
      invoiceCounts(
        defs,
        { values: { trees_planted: 6, trees_removed: 0, water_capacity_added: 500 }, other: [] },
        {
          values: { trees_planted: 41, trees_removed: 3, water_capacity_added: 1500, contacts: 9 },
          other: [],
        },
      ),
    ).toEqual([
      { id: 'trees_planted', label: 'Trees planted', unit: null, period: 6, all_time: 41 },
      {
        id: 'water_capacity_added',
        label: 'Water capacity added',
        unit: 'gal',
        period: 500,
        all_time: 1500,
      },
    ]);
  });

  it('follows the list order, not the order given', () => {
    const values = { certifications_earned: 1, contacts: 2 };
    expect(
      invoiceCounts(defs, { values, other: [] }, { values, other: [] }).map((c) => c.id),
    ).toEqual(['contacts', 'certifications_earned']);
  });

  it('adds other counts after, matched to their all-time total by label', () => {
    expect(
      invoiceCounts(
        defs,
        {
          values: {},
          other: [
            { label: 'Flyers ', value: 20 },
            { label: 'Calls', value: 0 },
          ],
        },
        {
          values: {},
          other: [
            { label: 'flyers', value: 50 },
            { label: 'Calls', value: 4 },
          ],
        },
      ),
    ).toEqual([{ id: null, label: 'Flyers', unit: null, period: 20, all_time: 50 }]);
  });
});

describe('roleDefaultLine (decision 0028)', () => {
  it("picks the role's only line on the source", () => {
    expect(roleDefaultLine(trainee, tisupp, null)).toBe('chw-experience-hours');
    expect(roleDefaultLine(trainee, tisupp, 'outreach-line')).toBe('chw-experience-hours');
  });

  it('keeps the last line used when the role bills it, else none', () => {
    expect(roleDefaultLine(lead, regen, 'maintenance-labor')).toBe('maintenance-labor');
    expect(roleDefaultLine(lead, regen, null)).toBeNull();
    const billed = new Set(funding(lead, regen.id).budget_lines.map((b) => b.id));
    const other = must(regen.budget_lines.find((l) => !billed.has(l.id)));
    expect(roleDefaultLine(lead, regen, other.id)).toBeNull();
  });
});

describe('entryCountChoices (decision 0029)', () => {
  it("shows the checked tasks' counts in list order", () => {
    const shown = entryCountChoices(
      file.counts,
      lead,
      regen,
      'fire-risk-reduction-work',
      ['firewise-assessing'],
      emptyCounts(),
    );
    expect(shown.map((c) => c.id)).toEqual(['trailer_loads_removed', 'assessments_completed']);
  });

  it('keeps a count that already has a value, so nothing entered is hidden', () => {
    const counts = { values: { trees_planted: 3, trees_removed: 0 }, other: [] };
    const shown = entryCountChoices(file.counts, lead, regen, 'maintenance-labor', [], counts);
    expect(shown.map((c) => c.id)).toEqual(['trees_planted']);
  });

  it('shows nothing before a line is picked', () => {
    expect(entryCountChoices(file.counts, lead, regen, null, ['other'], emptyCounts())).toEqual([]);
  });
});

describe('checkRolePicks (decisions 0028, 0033)', () => {
  it('accepts a line and tasks the role bills, dated inside the period', () => {
    expect(
      checkRolePicks(lead, regen, '2026-11-02', 'fire-risk-reduction-work', ['dump-runs']),
    ).toBeNull();
    expect(
      checkRolePicks(trainee, tisupp, '2026-10-01', 'chw-experience-hours', ['outreach']),
    ).toBeNull();
  });

  it('rejects a date outside the source period', () => {
    expect(
      checkRolePicks(trainee, tisupp, '2027-10-01', 'chw-experience-hours', ['outreach']),
    ).toBe('source_period');
    expect(
      checkRolePicks(trainee, tisupp, '2026-09-30', 'chw-experience-hours', ['outreach']),
    ).toBe('source_period');
  });

  it('rejects a line the role does not bill, or none', () => {
    const other = must(tisupp.budget_lines.find((l) => l.id !== 'chw-experience-hours'));
    expect(checkRolePicks(trainee, tisupp, '2026-11-02', other.id, ['outreach'])).toBe(
      'budget_line',
    );
    expect(checkRolePicks(trainee, tisupp, '2026-11-02', null, ['outreach'])).toBe('budget_line');
  });

  it('rejects no tasks, or a task not on the line', () => {
    expect(checkRolePicks(lead, regen, '2026-11-02', 'maintenance-labor', [])).toBe('task');
    expect(checkRolePicks(lead, regen, '2026-11-02', 'maintenance-labor', ['dump-runs'])).toBe(
      'task',
    );
  });
});

describe('roleUpdate (decision 0027, roles plan R7)', () => {
  const regenRate = { source_id: regen.id, rate_cents: 2200, nte_cents: null };
  const old: Role = { ...lead, id: 'r-tl00', code: 'R-TL00', retired: true, replaced_by: 'r-tl01' };

  it('is none without a role, active for a current role', () => {
    expect(roleUpdate(file.roles, null, [], sources)).toEqual({ state: 'none' });
    expect(roleUpdate(file.roles, 'r-tl01', [regenRate], sources)).toEqual({
      state: 'active',
      role: lead,
    });
  });

  it('moves a retired role to its replacement, adding new sources and noting rate changes', () => {
    const next: Role = {
      ...lead,
      funding: [...lead.funding, { ...funding(trainee, 'tisupp') }],
    };
    const roles = [old, next, trainee];
    const update = roleUpdate(roles, 'r-tl00', [{ ...regenRate, rate_cents: 2000 }], sources);
    expect(update).toEqual({
      state: 'replaced',
      from: old,
      role: next,
      add_settings: [{ source_id: 'tisupp', rate_cents: 2000, nte_cents: 1032000 }],
      rate_notes: [{ source_id: regen.id, rate_cents: 2200 }],
    });
  });

  it('follows a chain of replacements and notes nothing when rates match', () => {
    const mid: Role = {
      ...lead,
      id: 'r-tl05',
      code: 'R-TL05',
      retired: true,
      replaced_by: 'r-tl01',
    };
    const first: Role = { ...old, replaced_by: 'r-tl05' };
    const update = roleUpdate([first, mid, lead], 'r-tl00', [regenRate], sources);
    expect(update).toMatchObject({
      state: 'replaced',
      role: lead,
      add_settings: [],
      rate_notes: [],
    });
  });

  it('is inactive for a retired role with no replacement, or an id the file lost', () => {
    const gone: Role = { ...lead, id: 'r-tl09', retired: true };
    expect(roleUpdate([gone, lead], 'r-tl09', [regenRate], sources)).toEqual({
      state: 'inactive',
      role: gone,
    });
    expect(roleUpdate(file.roles, 'nobody', [], sources)).toEqual({
      state: 'inactive',
      role: null,
    });
  });
});
