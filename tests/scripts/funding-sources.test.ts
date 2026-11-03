import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFundingSources, makeValidator } from '../../scripts/lib/funding-sources.mjs';
import { readJson } from '../../scripts/lib/json.mjs';

type SourceFile = Record<string, unknown> & {
  tasks: Record<string, unknown>[];
  budget_lines: Record<string, unknown>[];
};

const root = join(import.meta.dirname, '..', '..');
const validate = makeValidator(readJson(join(root, 'schemas', 'funding-source.schema.json')));
const readSource = (id: string) =>
  readJson(join(root, 'src', 'funding-sources', `${id}.json`)) as SourceFile;
const tisupp = readSource('tisupp');

/** The item at an index, which the test knows exists. */
function item(list: Record<string, unknown>[], index: number): Record<string, unknown> {
  const found = list[index];
  if (!found) throw new Error(`no item ${String(index)}`);
  return found;
}

function changed(change: (copy: SourceFile) => void) {
  const copy = structuredClone(tisupp);
  change(copy);
  return validate(copy);
}

describe('funding source files', () => {
  it('are all valid', () => {
    expect(checkFundingSources(root)).toEqual([]);
  });

  it('rename the survey task, keeping its id (decision 0019)', () => {
    for (const source of [tisupp, readSource('regen-general-operating')]) {
      expect(source.tasks.find((t) => t['id'] === 'planning-and-conducting-surveys')).toMatchObject(
        {
          name: 'Individual and community assessment',
          core_competency: 'Individual & Community Assessment',
        },
      );
    }
  });

  it('TISUPP has 21 tasks, 13 budget lines, an NTE and a $20.00 default rate (SPEC §3, §4)', () => {
    expect(tisupp['code']).toBe('TISUPP');
    expect(tisupp['version']).toBe(5);
    expect(tisupp.tasks).toHaveLength(21);
    expect(tisupp.budget_lines).toHaveLength(13);
    expect(tisupp['has_nte']).toBe(true);
    expect(tisupp['default_rate_cents']).toBe(2000);
  });

  it('TISUPP adds the CHW experience hours line and a raise to $23.00 after 240 hours (roles plan P1)', () => {
    expect(tisupp.budget_lines[12]).toEqual({
      id: 'chw-experience-hours',
      name: 'CHW experience hours',
    });
    expect(tisupp['rate_step']).toEqual({ after_quarters: 960, rate_cents: 2300 });
  });

  it('Regen General Operating adds Domestic support with no competency and has no NTE (SPEC §3)', () => {
    const regen = readSource('regen-general-operating');
    expect(regen['code']).toBe('REGEN-GO');
    expect(regen['has_nte']).toBe(false);
    expect(regen.tasks.slice(0, 21)).toEqual(tisupp.tasks);
    expect(regen.budget_lines.slice(0, 12)).toEqual(tisupp.budget_lines.slice(0, 12));
    expect(regen.tasks[21]).toEqual({
      id: 'domestic-support',
      name: 'Domestic support',
      core_competency: null,
    });
    expect(regen.budget_lines[12]).toEqual({ id: 'domestic-support', name: 'Domestic support' });
  });

  it('TISUPP: CHW Cert eligibility at 480 hours and a report funding line (decision 0026)', () => {
    expect(tisupp['certification_step']).toEqual({ after_quarters: 1920, name: 'CHW Cert' });
    expect(tisupp['report_funding_line']).toBe(
      "Trauma-Informed Substance Use Prevention Program (TISUPP), funded by the Governor's Office of Youth, Faith and Family through Arizona State University. Contracted through Regenerating Sonora, Inc.",
    );
  });
});

describe('grant periods and the Resilience Team Lead (roles plan R1, decisions 0028, 0031, 0033)', () => {
  const regen = readSource('regen-general-operating');

  it('TISUPP runs October 1, 2026 to September 30, 2027 and has the employee certification', () => {
    expect(tisupp['period_start']).toBe('2026-10-01');
    expect(tisupp['period_end']).toBe('2027-09-30');
    expect(tisupp['employee_certification_text']).toBe(
      'I certify that the hours shown on this timesheet were worked on the dates listed for the TISUPP grant, the hours are accurate, no participant names are included, and these hours have not been reported under any other funding source.',
    );
  });

  it('Regen General Operating has no start or end date, at version 3', () => {
    expect(regen['version']).toBe(3);
    expect(regen['period_start']).toBeNull();
    expect(regen['period_end']).toBeNull();
  });

  it('Regen General Operating keeps its 22 tasks and 13 lines, then adds 15 tasks and 5 lines', () => {
    expect(regen.tasks).toHaveLength(37);
    expect(regen.budget_lines).toHaveLength(18);
    expect(regen.tasks[21]).toMatchObject({ id: 'domestic-support' });
    expect(regen.budget_lines[12]).toMatchObject({ id: 'domestic-support' });
    expect(regen.tasks.slice(22)).toEqual(
      [
        ['firewise-assessing', 'Firewise assessing'],
        ['residential-fuel-reduction', 'Residential fuel reduction'],
        ['municipal-fuel-reduction', 'Municipal fuel reduction'],
        ['dump-runs', 'Dump runs'],
        ['lehr-maintenance', 'LEHR maintenance'],
        ['pinal-garden-maintenance', 'Pinal garden maintenance'],
        ['regen-lot-clean-and-maintenance', 'Regen lot clean and maintenance'],
        ['transport-and-supply-runs', 'Transport and supply runs'],
        ['plant-propagation', 'Plant propagation'],
        ['tree-planting', 'Tree planting'],
        ['tree-removal', 'Tree removal'],
        ['water-harvesting', 'Water harvesting'],
        ['garden-support', 'Garden support'],
        ['paid-training', 'Paid training'],
        ['other', 'Other'],
      ].map(([id, name]) => ({ id, name, core_competency: null })),
    );
    expect(regen.budget_lines.slice(13)).toEqual([
      { id: 'fire-risk-reduction-work', name: 'Fire risk reduction work' },
      { id: 'maintenance-labor', name: 'Maintenance labor' },
      { id: 'resilient-home-services-contracting', name: 'Resilient Home Services contracting' },
      { id: 'team-development', name: 'Team development' },
      { id: 'other-contractors', name: 'Other contractors', display_name: 'Other' },
    ]);
  });
});

describe('funding source schema', () => {
  it('requires the grant period, as dates or null (decision 0033)', () => {
    expect(changed((s) => delete s['period_start'])).not.toEqual([]);
    expect(changed((s) => delete s['period_end'])).not.toEqual([]);
    expect(changed((s) => (s['period_end'] = null))).toEqual([]);
    expect(changed((s) => (s['period_start'] = '10/01/2026'))).not.toEqual([]);
  });

  it('rejects a period that ends before it starts (decision 0033)', () => {
    expect(changed((s) => (s['period_end'] = '2026-09-30'))).toContain(
      '/period_end 2026-09-30 comes before period_start 2026-10-01',
    );
    expect(changed((s) => (s['period_end'] = '2026-10-01'))).toEqual([]);
  });

  it('accepts an optional display name and employee certification, never blank (decisions 0028, 0031)', () => {
    expect(changed((s) => (item(s.budget_lines, 0)['display_name'] = 'New CHWs'))).toEqual([]);
    expect(changed((s) => (item(s.budget_lines, 0)['display_name'] = ''))).not.toEqual([]);
    expect(changed((s) => (item(s.budget_lines, 0)['display_name'] = ' x'))).not.toEqual([]);
    expect(changed((s) => delete s['employee_certification_text'])).toEqual([]);
    expect(changed((s) => (s['employee_certification_text'] = ''))).not.toEqual([]);
  });

  it('rejects a missing field', () => {
    expect(changed((s) => delete s['certification_text'])).not.toEqual([]);
  });

  it('rejects an extra field', () => {
    expect(changed((s) => (s['color'] = 'blue'))).not.toEqual([]);
    expect(changed((s) => (item(s.tasks, 0)['hint'] = 'x'))).not.toEqual([]);
  });

  it('rejects a different format version', () => {
    expect(changed((s) => (s['format_version'] = 2))).not.toEqual([]);
  });

  it('rejects a fractional or zero default rate and accepts null', () => {
    expect(changed((s) => (s['default_rate_cents'] = 20.5))).not.toEqual([]);
    expect(changed((s) => (s['default_rate_cents'] = 0))).not.toEqual([]);
    expect(changed((s) => (s['default_rate_cents'] = null))).toEqual([]);
  });

  it('accepts an optional rate step and NTE, and rejects bad ones', () => {
    expect(changed((s) => (s['default_nte_cents'] = 1032000))).toEqual([]);
    expect(changed((s) => (s['default_nte_cents'] = 0))).not.toEqual([]);
    expect(changed((s) => (s['rate_step'] = { after_quarters: 960, rate_cents: 2300 }))).toEqual(
      [],
    );
    expect(changed((s) => (s['rate_step'] = { after_quarters: 960 }))).not.toEqual([]);
    expect(
      changed((s) => (s['rate_step'] = { after_quarters: 9.5, rate_cents: 2300 })),
    ).not.toEqual([]);
  });

  it('rejects a bad core competency or untrimmed text', () => {
    expect(changed((s) => (item(s.tasks, 0)['core_competency'] = 3))).not.toEqual([]);
    expect(changed((s) => (item(s.tasks, 0)['core_competency'] = ''))).not.toEqual([]);
    expect(changed((s) => (item(s.tasks, 0)['name'] = ' Outreach'))).not.toEqual([]);
  });

  it('rejects ids that are not lower-case slugs', () => {
    expect(changed((s) => (s['id'] = 'TISUPP'))).not.toEqual([]);
    expect(changed((s) => (item(s.budget_lines, 0)['id'] = 'new chws'))).not.toEqual([]);
  });

  it('rejects duplicate task or budget line ids and names', () => {
    expect(changed((s) => (item(s.tasks, 1)['id'] = 'outreach'))).toContain(
      '/tasks has duplicate id "outreach"',
    );
    expect(
      changed((s) => (item(s.budget_lines, 1)['name'] = item(s.budget_lines, 0)['name'])),
    ).not.toEqual([]);
  });

  it('rejects a bad default NTE or rate step', () => {
    expect(changed((s) => (s['default_nte_cents'] = 0))).not.toEqual([]);
    expect(changed((s) => (s['default_nte_cents'] = 10.5))).not.toEqual([]);
    expect(changed((s) => (s['rate_step'] = { after_quarters: 960 }))).not.toEqual([]);
    expect(changed((s) => (s['rate_step'] = { after_quarters: 0, rate_cents: 2300 }))).not.toEqual(
      [],
    );
    expect(changed((s) => delete s['rate_step'])).toEqual([]);
    expect(changed((s) => (s['certification_step'] = { after_quarters: 1920 }))).not.toEqual([]);
    expect(
      changed((s) => (s['certification_step'] = { after_quarters: 0, name: 'X' })),
    ).not.toEqual([]);
    expect(changed((s) => (s['report_funding_line'] = ''))).not.toEqual([]);
    expect(changed((s) => delete s['certification_step'])).toEqual([]);
    expect(changed((s) => delete s['report_funding_line'])).toEqual([]);
    expect(changed((s) => delete s['default_nte_cents'])).toEqual([]);
  });

  it('rejects empty lists', () => {
    expect(changed((s) => (s.tasks = []))).not.toEqual([]);
    expect(changed((s) => (s.budget_lines = []))).not.toEqual([]);
  });
});
