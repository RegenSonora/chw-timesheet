import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectRuntimeLicenses,
  isAllowed,
  licenseProblems,
  renderLicenses,
} from '../../scripts/lib/licenses.mjs';

function fakeProject(deps: Record<string, { license: string; deps?: Record<string, string> }>) {
  const root = mkdtempSync(join(tmpdir(), 'chw-licenses-'));
  const top = Object.fromEntries(
    Object.keys(deps)
      .filter((name) => name !== 'tiny-dep')
      .map((n) => [n, '1.0.0']),
  );
  writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: top }));
  for (const [name, { license, deps: sub }] of Object.entries(deps)) {
    const dir = join(root, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        license,
        repository: name === 'zeta' ? `x/${name}` : `git+https://github.com/x/${name}.git`,
        dependencies: sub,
      }),
    );
    writeFileSync(join(dir, 'LICENSE'), `${license} text for ${name}\r\n`);
  }
  return root;
}

describe('isAllowed', () => {
  it('accepts permissive licenses and OR expressions', () => {
    expect(isAllowed('MIT')).toBe(true);
    expect(isAllowed('(MIT OR GPL-3.0)')).toBe(true);
  });

  it('rejects copyleft and unknown licenses', () => {
    expect(isAllowed('GPL-3.0')).toBe(false);
    expect(isAllowed('UNKNOWN')).toBe(false);
  });
});

describe('collectRuntimeLicenses', () => {
  it('includes transitive runtime dependencies, sorted, with normalized text', () => {
    const root = fakeProject({
      zeta: { license: 'MIT', deps: { 'tiny-dep': '1.0.0' } },
      alpha: { license: 'ISC' },
      'tiny-dep': { license: 'BSD-3-Clause' },
    });
    const packages = collectRuntimeLicenses(root);
    expect(packages.map((p) => p.name)).toEqual(['alpha', 'tiny-dep', 'zeta']);
    expect(packages[0]?.text).toBe('ISC text for alpha');
    expect(packages[0]?.source).toBe('https://github.com/x/alpha');
    expect(packages[2]?.source).toBe('https://github.com/x/zeta');
    expect(licenseProblems(packages)).toEqual([]);
  });

  it('reports a disallowed license', () => {
    const root = fakeProject({ bad: { license: 'GPL-3.0' } });
    expect(licenseProblems(collectRuntimeLicenses(root))).toEqual([
      'bad@1.0.0: license "GPL-3.0" is not allowed',
    ]);
  });
});

describe('renderLicenses', () => {
  it('is deterministic and lists each package', () => {
    const packages = [
      { name: 'preact', version: '1.0.0', license: 'MIT', source: 'https://x', text: 'MIT text' },
    ];
    const out = renderLicenses(packages);
    expect(out).toBe(renderLicenses(packages));
    expect(out).toContain('## preact 1.0.0');
    expect(out).toContain('- License: MIT');
    expect(out).toContain('MIT text');
  });
});
