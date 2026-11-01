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

  it('TISUPP has 21 tasks, 12 budget lines, an NTE and a $20.00 default rate (SPEC §3, §4)', () => {
    expect(tisupp['code']).toBe('TISUPP');
    expect(tisupp.tasks).toHaveLength(21);
    expect(tisupp.budget_lines).toHaveLength(12);
    expect(tisupp['has_nte']).toBe(true);
    expect(tisupp['default_rate_cents']).toBe(2000);
  });

  it('Regen General Operating adds Domestic support with no competency and has no NTE (SPEC §3)', () => {
    const regen = readSource('regen-general-operating');
    expect(regen['code']).toBe('REGEN-GO');
    expect(regen['has_nte']).toBe(false);
    expect(regen.tasks).toHaveLength(22);
    expect(regen.budget_lines).toHaveLength(13);
    expect(regen.tasks.slice(0, 21)).toEqual(tisupp.tasks);
    expect(regen.budget_lines.slice(0, 12)).toEqual(tisupp.budget_lines);
    expect(regen.tasks[21]).toEqual({
      id: 'domestic-support',
      name: 'Domestic support',
      core_competency: null,
    });
    expect(regen.budget_lines[12]).toEqual({ id: 'domestic-support', name: 'Domestic support' });
  });
});

describe('funding source schema', () => {
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

  it('rejects empty lists', () => {
    expect(changed((s) => (s.tasks = []))).not.toEqual([]);
    expect(changed((s) => (s.budget_lines = []))).not.toEqual([]);
  });
});
