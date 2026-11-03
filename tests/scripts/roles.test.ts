import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../scripts/lib/json.mjs';
import { makeRolesValidator } from '../../scripts/lib/roles.mjs';

interface RoleTask {
  id: string;
  count_ids: string[];
}
interface RoleLine {
  id: string;
  tasks: RoleTask[];
}
interface Funding {
  source_id: string;
  rate_cents?: number;
  nte_cents?: number;
  rate_step?: { after_quarters: number; rate_cents: number };
  ends?: string;
  budget_lines: RoleLine[];
}
interface Role {
  id: string;
  code: string;
  name: string;
  employment: string;
  chw: boolean;
  certification_step?: { after_quarters: number; name: string };
  retired?: boolean;
  replaced_by?: string;
  funding: Funding[];
}
interface Count {
  id: string;
  label: string;
  unit?: string;
  retired?: boolean;
}
interface RolesFile {
  format_version: number;
  version: number;
  counts: Count[];
  roles: Role[];
}

const root = join(import.meta.dirname, '..', '..');
const rolesFile = readJson(join(root, 'src', 'roles', 'roles.json')) as RolesFile;
const validate = makeRolesValidator(readJson(join(root, 'schemas', 'roles.schema.json')));

function role(code: string): Role {
  const found = rolesFile.roles.find((r) => r.code === code);
  if (!found) throw new Error(`no role ${code}`);
  return found;
}

/** Count labels to ids, in the shared list's order (decision 0029). */
function countIds(labels: string[]): string[] {
  return rolesFile.counts.filter((c) => labels.includes(c.label)).map((c) => c.id);
}

/** Every count ever released, by id. Never remove or relabel one (decision 0029). */
const RELEASED_COUNTS: Record<string, string> = {
  contacts: 'Contacts',
  referrals_given: 'Referrals given',
  referral_followups: 'Referral follow-ups',
  rides_provided: 'Rides provided',
  applications_completed: 'Applications completed',
  client_goals_achieved: 'Client goals achieved',
  quick_wins_provided: 'Quick wins provided',
  screenings_conducted: 'Screenings conducted',
  applications_approved: 'Applications approved',
  trailer_loads_removed: 'Trailer loads removed',
  assessments_completed: 'Assessments completed',
  lehr_resets_completed: 'LEHR resets completed',
  plants_propagated: 'Plants propagated',
  trees_planted: 'Trees planted',
  trees_removed: 'Trees removed',
  water_capacity_added: 'Water capacity added',
  grow_space_added: 'Grow space added',
  certifications_earned: 'Certifications earned',
};

/** Roles plan Part 2: CHW Trainee tasks (TISUPP ids, in TISUPP order) and their counts. */
const CHW_TRAINEE_TASKS: [string, string[]][] = [
  ['outreach', ['Contacts']],
  ['interview-and-intake', ['Screenings conducted', 'Applications completed']],
  [
    'screening-and-referrals',
    ['Referrals given', 'Screenings conducted', 'Referral follow-ups', 'Applications completed'],
  ],
  ['resource-research', ['Referral follow-ups', 'Contacts']],
  [
    'resource-acquisition',
    [
      'Quick wins provided',
      'Applications approved',
      'Client goals achieved',
      'Applications completed',
      'Rides provided',
      'Referral follow-ups',
      'Referrals given',
      'Contacts',
    ],
  ],
  [
    'application-assistance',
    [
      'Applications completed',
      'Applications approved',
      'Referrals given',
      'Client goals achieved',
      'Quick wins provided',
    ],
  ],
  [
    'transportation',
    ['Rides provided', 'Quick wins provided', 'Client goals achieved', 'Applications completed'],
  ],
  [
    'advocacy',
    [
      'Quick wins provided',
      'Referral follow-ups',
      'Referrals given',
      'Client goals achieved',
      'Screenings conducted',
      'Applications approved',
    ],
  ],
  ['conversational-support', ['Contacts', 'Quick wins provided', 'Referrals given']],
  [
    'supporting-client-self-efficacy',
    [
      'Client goals achieved',
      'Referrals given',
      'Applications completed',
      'Quick wins provided',
      'Applications approved',
    ],
  ],
  ['technical-assistance', ['Client goals achieved', 'Quick wins provided']],
  ['client-or-community-workshops', ['Contacts']],
  [
    'client-check-in',
    [
      'Client goals achieved',
      'Quick wins provided',
      'Referrals given',
      'Referral follow-ups',
      'Applications completed',
    ],
  ],
  [
    'client-follow-up',
    [
      'Referral follow-ups',
      'Client goals achieved',
      'Applications approved',
      'Quick wins provided',
      'Applications completed',
      'Referrals given',
    ],
  ],
  ['re-screening', ['Referrals given', 'Screenings conducted', 'Contacts']],
  // "Individual and community assessment" keeps its old id (decision 0019).
  ['planning-and-conducting-surveys', ['Contacts', 'Screenings conducted', 'Referrals given']],
  ['documentation', []],
  ['data-analysis-and-reporting', []],
  ['developing-tools-processes', []],
  ['meetings', []],
  ['training-continuing-education', []],
];

/** Roles plan Part 2: Resilience Team Lead lines, tasks and counts on REGEN-GO. */
const TEAM_LEAD_LINES: [string, [string, string[]][]][] = [
  [
    'fire-risk-reduction-work',
    [
      ['firewise-assessing', ['Assessments completed', 'Trailer loads removed']],
      ['residential-fuel-reduction', ['Trailer loads removed']],
      ['municipal-fuel-reduction', ['Trailer loads removed']],
      ['dump-runs', ['Trailer loads removed']],
    ],
  ],
  [
    'maintenance-labor',
    [
      ['lehr-maintenance', ['LEHR resets completed']],
      ['pinal-garden-maintenance', []],
      ['regen-lot-clean-and-maintenance', []],
      ['transport-and-supply-runs', []],
    ],
  ],
  [
    'resilient-home-services-contracting',
    [
      ['plant-propagation', ['Plants propagated']],
      ['tree-planting', ['Trees planted']],
      ['tree-removal', ['Trees removed']],
      ['water-harvesting', ['Water capacity added']],
      ['garden-support', ['Grow space added']],
    ],
  ],
  ['team-development', [['paid-training', ['Certifications earned']]]],
  ['other-contractors', [['other', []]]],
];

describe('roles file (roles plan Part 2, decisions 0027, 0029)', () => {
  it('matches the schema', () => {
    expect(validate(rolesFile)).toEqual([]);
    expect(rolesFile.format_version).toBe(1);
  });

  it('keeps every released count with its label, in the shared list order', () => {
    const now = Object.fromEntries(rolesFile.counts.map((c) => [c.id, c.label]));
    for (const [id, label] of Object.entries(RELEASED_COUNTS)) expect(now[id], id).toBe(label);
    expect(rolesFile.counts.map((c) => c.id).slice(0, 18)).toEqual(Object.keys(RELEASED_COUNTS));
  });

  it('gives water capacity gallons and grow space square feet', () => {
    const units = rolesFile.counts.filter((c) => c.unit).map((c) => [c.id, c.unit]);
    expect(units).toEqual([
      ['water_capacity_added', 'gal'],
      ['grow_space_added', 'sq ft'],
    ]);
  });

  it('ships three active roles: two CHW Trainees and the Resilience Team Lead', () => {
    expect(
      rolesFile.roles.map((r) => [r.id, r.code, r.name, r.employment, r.chw, r.retired ?? false]),
    ).toEqual([
      ['chw-tc01', 'CHW-TC01', 'CHW Trainee (Contractor)', 'contractor', true, false],
      ['chw-te01', 'CHW-TE01', 'CHW Trainee (Employee)', 'employee', true, false],
      ['r-tl01', 'R-TL01', 'Resilience Team Lead', 'contractor', false, false],
    ]);
  });

  it('CHW Trainees bill TISUPP at $20.00, $23.00 after 240 hrs, cert at 480 hrs (0030, 0032)', () => {
    for (const code of ['CHW-TC01', 'CHW-TE01']) {
      const r = role(code);
      expect(r.certification_step).toEqual({ after_quarters: 1920, name: 'CHW Cert' });
      expect(r.funding).toHaveLength(1);
      expect(r.funding[0]).toMatchObject({
        source_id: 'tisupp',
        rate_cents: 2000,
        rate_step: { after_quarters: 960, rate_cents: 2300 },
      });
    }
    expect(role('CHW-TC01').funding[0]?.nte_cents).toBe(1032000);
    // Employee roles leave the NTE blank (decision 0031).
    expect(role('CHW-TE01').funding[0]?.nte_cents).toBeUndefined();
  });

  it('CHW Trainees: all 21 TISUPP tasks on CHW experience hours, with their counts', () => {
    const expected = [
      {
        id: 'chw-experience-hours',
        tasks: CHW_TRAINEE_TASKS.map(([id, labels]) => ({ id, count_ids: countIds(labels) })),
      },
    ];
    expect(role('CHW-TC01').funding[0]?.budget_lines).toEqual(expected);
    expect(role('CHW-TE01').funding[0]?.budget_lines).toEqual(expected);
  });

  it('Resilience Team Lead bills Regen General Operating at $22.00 with no raise or NTE', () => {
    const r = role('R-TL01');
    expect(r.certification_step).toBeUndefined();
    expect(r.funding).toHaveLength(1);
    const [funding] = r.funding;
    expect(funding?.source_id).toBe('regen-general-operating');
    expect(funding?.rate_cents).toBe(2200);
    expect(funding?.rate_step).toBeUndefined();
    expect(funding?.nte_cents).toBeUndefined();
    expect(funding?.budget_lines).toEqual(
      TEAM_LEAD_LINES.map(([id, tasks]) => ({
        id,
        tasks: tasks.map(([task, labels]) => ({ id: task, count_ids: countIds(labels) })),
      })),
    );
  });
});

describe('roles schema', () => {
  function changed(change: (copy: RolesFile) => void) {
    const copy = structuredClone(rolesFile);
    change(copy);
    return validate(copy);
  }
  const first = (f: RolesFile) => f.roles[0] as Role;

  it('rejects count ids with hyphens and role ids with underscores', () => {
    expect(changed((f) => ((f.counts[0] as Count).id = 'trees-planted'))).not.toEqual([]);
    expect(changed((f) => (first(f).id = 'chw_tc01'))).not.toEqual([]);
  });

  it('rejects an unknown employment type and an extra field', () => {
    expect(changed((f) => (first(f).employment = 'volunteer'))).not.toEqual([]);
    expect(
      changed((f) => ((first(f) as unknown as Record<string, unknown>)['person'] = 'x')),
    ).not.toEqual([]);
  });

  it('rejects money that is not whole cents', () => {
    expect(changed((f) => ((first(f).funding[0] as Funding).rate_cents = 20.5))).not.toEqual([]);
    expect(changed((f) => ((first(f).funding[0] as Funding).nte_cents = 0))).not.toEqual([]);
  });

  it('rejects empty funding, budget lines and tasks, and accepts a task with no counts', () => {
    expect(changed((f) => (first(f).funding = []))).not.toEqual([]);
    expect(changed((f) => ((first(f).funding[0] as Funding).budget_lines = []))).not.toEqual([]);
    expect(
      changed((f) => (((first(f).funding[0] as Funding).budget_lines[0] as RoleLine).tasks = [])),
    ).not.toEqual([]);
  });

  it('rejects a blank unit or label, and an end date that is not a date', () => {
    expect(changed((f) => ((f.counts[0] as Count).unit = ''))).not.toEqual([]);
    expect(changed((f) => ((f.counts[0] as Count).label = ' Contacts'))).not.toEqual([]);
    expect(changed((f) => ((first(f).funding[0] as Funding).ends = 'June 30'))).not.toEqual([]);
    expect(changed((f) => ((first(f).funding[0] as Funding).ends = '2027-06-30'))).toEqual([]);
  });
});
