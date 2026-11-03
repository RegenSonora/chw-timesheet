import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../scripts/lib/json.mjs';
import { checkRoles, checkRolesData, makeRolesValidator } from '../../scripts/lib/roles.mjs';

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
const rolesSchema = readJson(join(root, 'schemas', 'roles.schema.json'));
const validate = makeRolesValidator(rolesSchema);
type SourceFile = Record<string, unknown> & { id: string; code: string };
const sources = ['tisupp', 'regen-general-operating'].map(
  (id) => readJson(join(root, 'src', 'funding-sources', `${id}.json`)) as SourceFile,
);

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

describe('build checks against the source files (roles plan R1)', () => {
  /** Problems after one change to copies of the shipped roles and sources. */
  function broken(change: (f: RolesFile, s: SourceFile[]) => void): string[] {
    const copy = structuredClone(rolesFile);
    const sourceCopies = structuredClone(sources);
    change(copy, sourceCopies);
    return checkRolesData(copy, sourceCopies, rolesSchema);
  }
  const tc = (f: RolesFile) => f.roles[0] as Role;
  const te = (f: RolesFile) => f.roles[1] as Role;
  const tl = (f: RolesFile) => f.roles[2] as Role;
  const funding = (r: Role) => r.funding[0] as Funding;
  const line = (r: Role) => funding(r).budget_lines[0] as RoleLine;
  const task = (r: Role) => line(r).tasks[0] as RoleTask;
  const source = (s: SourceFile[], id: string) => s.find((x) => x.id === id) as SourceFile;
  /** Drop a count from every task of every role. */
  const unuse = (f: RolesFile, id: string) => {
    for (const r of f.roles)
      for (const fu of r.funding)
        for (const l of fu.budget_lines)
          for (const t of l.tasks) t.count_ids = t.count_ids.filter((c) => c !== id);
  };
  /** A retired copy of R-TL01, for replacement tests. */
  const retiredLead = (f: RolesFile, id: string, replacedBy?: string) => {
    const old: Role = { ...structuredClone(tl(f)), id, code: id.toUpperCase(), retired: true };
    if (replacedBy) old.replaced_by = replacedBy;
    f.roles.push(old);
  };

  it('passes the shipped files', () => {
    expect(checkRoles(root)).toEqual([]);
  });

  it('rejects a duplicate role id or code; a retired role keeps its id', () => {
    expect(broken((f) => (te(f).id = 'chw-tc01'))).toContain(
      'role CHW-TE01: id "chw-tc01" is already used by role CHW-TC01',
    );
    expect(broken((f) => (te(f).code = 'CHW-TC01'))).toContain(
      'role CHW-TC01: code is used by more than one role',
    );
    expect(
      broken((f) => {
        retiredLead(f, 'r-tl00');
        te(f).id = 'r-tl00';
      }),
    ).toContain('role R-TL00: id "r-tl00" is already used by role CHW-TE01');
  });

  it('rejects a reused count id, or a label matching another count, retired ones included', () => {
    expect(broken((f) => f.counts.push({ id: 'contacts', label: 'People reached' }))).toContain(
      'count "contacts": id is used more than once',
    );
    expect(
      broken((f) => f.counts.push({ id: 'trees_planted_2', label: 'trees  Planted' })),
    ).toContain('count "trees_planted_2": label "trees  Planted" matches count "trees_planted"');
    expect(
      broken((f) => {
        (f.counts[3] as Count).retired = true;
        unuse(f, 'rides_provided');
        f.counts.push({ id: 'rides_given', label: 'Rides provided' });
      }),
    ).toContain('count "rides_given": label "Rides provided" matches count "rides_provided"');
  });

  it('rejects a source, line, task or count listed twice in one role', () => {
    expect(broken((f) => tl(f).funding.push(structuredClone(funding(tl(f)))))).toContain(
      'role R-TL01: funding "regen-general-operating" is listed twice',
    );
    expect(broken((f) => funding(tl(f)).budget_lines.push(structuredClone(line(tl(f)))))).toContain(
      'role R-TL01, funding regen-general-operating: budget line "fire-risk-reduction-work" is listed twice',
    );
    expect(broken((f) => line(tc(f)).tasks.push(structuredClone(task(tc(f)))))).toContain(
      'role CHW-TC01, funding tisupp, budget line chw-experience-hours: task "outreach" is listed twice',
    );
    expect(broken((f) => task(tc(f)).count_ids.push('contacts'))).toContain(
      'role CHW-TC01, funding tisupp, budget line chw-experience-hours, task outreach: count "contacts" is listed twice',
    );
  });

  it('rejects a source, budget line, task or count that does not exist', () => {
    expect(broken((f) => (funding(tc(f)).source_id = 'tisup'))).toContain(
      `role CHW-TC01: funding source "tisup" doesn't exist`,
    );
    expect(broken((f) => (line(tc(f)).id = 'chw-hours'))).toContain(
      `role CHW-TC01, funding tisupp: budget line "chw-hours" isn't in TISUPP`,
    );
    expect(broken((f) => (task(tc(f)).id = 'outreech'))).toContain(
      `role CHW-TC01, funding tisupp, budget line chw-experience-hours: task "outreech" isn't in TISUPP`,
    );
    expect(broken((f) => (task(tc(f)).count_ids = ['contact']))).toContain(
      `role CHW-TC01, funding tisupp, budget line chw-experience-hours, task outreach: count "contact" isn't in the count list`,
    );
  });

  it('rejects an active role using a retired count', () => {
    expect(broken((f) => ((f.counts[0] as Count).retired = true))).toContain(
      'role CHW-TC01, funding tisupp, budget line chw-experience-hours, task outreach: count "contacts" is retired',
    );
  });

  it('names the role when a list is empty', () => {
    expect(broken((f) => (tl(f).funding = []))).toContain('role R-TL01: funding is empty');
    expect(broken((f) => (funding(tl(f)).budget_lines = []))).toContain(
      'role R-TL01: funding 1 budget_lines is empty',
    );
    expect(broken((f) => (line(tl(f)).tasks = []))).toContain(
      'role R-TL01: funding 1 budget_lines 1 tasks is empty',
    );
  });

  it('checks replaced_by: only on retired roles, to an active role, with no loop', () => {
    expect(broken((f) => (tl(f).replaced_by = 'chw-tc01'))).toContain(
      `role R-TL01: replaced_by is set but the role isn't retired`,
    );
    expect(
      broken((f) => {
        retiredLead(f, 'r-tl00', 'r-tl02');
      }),
    ).toContain(`role R-TL00: replaced_by "r-tl02" doesn't exist`);
    expect(
      broken((f) => {
        retiredLead(f, 'r-tl00', 'r-tlx');
        retiredLead(f, 'r-tlx', 'r-tl01');
      }),
    ).toContain('role R-TL00: replaced_by "r-tlx" is retired');
    expect(
      broken((f) => {
        retiredLead(f, 'r-tla', 'r-tlb');
        retiredLead(f, 'r-tlb', 'r-tla');
      }),
    ).toContain('role R-TLA: replaced_by forms a loop: r-tla → r-tlb → r-tla');
  });

  it('rejects money that is not whole cents, and an NTE on a source without one', () => {
    expect(broken((f) => (funding(tl(f)).rate_cents = 22.5))).toContain(
      'role R-TL01: funding 1 rate_cents must be integer',
    );
    expect(broken((f) => (funding(tl(f)).nte_cents = 500000))).toContain(
      'role R-TL01, funding regen-general-operating: nte_cents is set but REGEN-GO has no NTE',
    );
  });

  it('rejects an end date outside the source period, or not a real date (decision 0033)', () => {
    const period = `outside TISUPP's period (2026-10-01 to 2027-09-30)`;
    expect(broken((f) => (funding(tc(f)).ends = '2027-12-31'))).toContain(
      `role CHW-TC01, funding tisupp: ends 2027-12-31 is ${period}`,
    );
    expect(broken((f) => (funding(tc(f)).ends = '2026-09-30'))).toContain(
      `role CHW-TC01, funding tisupp: ends 2026-09-30 is ${period}`,
    );
    expect(broken((f) => (funding(tc(f)).ends = '2027-02-30'))).toContain(
      `role CHW-TC01, funding tisupp: ends 2027-02-30 isn't a real date`,
    );
    expect(broken((f) => (funding(tc(f)).ends = '2027-06-30'))).toEqual([]);
    expect(broken((f) => (funding(tl(f)).ends = '2030-01-01'))).toEqual([]);
  });

  it('rejects a certification step on a non-CHW role (decision 0032)', () => {
    expect(
      broken((f) => (tl(f).certification_step = { after_quarters: 1920, name: 'CHW Cert' })),
    ).toContain('role R-TL01: certification_step is only for CHW roles (chw: true)');
  });

  it('rejects an employee role on a source with no employee certification (decision 0031)', () => {
    const missing = `has no employee_certification_text and the role doesn't set one`;
    expect(broken((f) => (tl(f).employment = 'employee'))).toContain(
      `role R-TL01, funding regen-general-operating: employee role, but REGEN-GO ${missing}`,
    );
    expect(
      broken((f) => {
        tl(f).employment = 'employee';
        (tl(f) as unknown as Record<string, unknown>)['employee_certification_text'] = 'I certify.';
      }),
    ).toEqual([]);
    expect(
      broken((_f, s) => {
        delete source(s, 'tisupp')['employee_certification_text'];
      }),
    ).toContain(`role CHW-TE01, funding tisupp: employee role, but TISUPP ${missing}`);
  });
});
