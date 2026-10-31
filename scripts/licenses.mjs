// Writes THIRD_PARTY_LICENSES.md, or with --check fails when it is stale or a license is not allowed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectRuntimeLicenses, licenseProblems, renderLicenses } from './lib/licenses.mjs';

const root = join(import.meta.dirname, '..');
const target = join(root, 'THIRD_PARTY_LICENSES.md');
const packages = collectRuntimeLicenses(root);
const problems = licenseProblems(packages);
const content = renderLicenses(packages);

if (problems.length) {
  console.error(`License problems:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8').replace(/\r\n?/g, '\n');
  } catch {
    // A missing file counts as stale.
  }
  if (current !== content) {
    console.error(
      'THIRD_PARTY_LICENSES.md is out of date. Run pnpm licenses:update and commit the result.',
    );
    process.exit(1);
  }
  console.log(`THIRD_PARTY_LICENSES.md is current (${String(packages.length)} runtime packages).`);
} else {
  writeFileSync(target, content);
  console.log(`Wrote THIRD_PARTY_LICENSES.md (${String(packages.length)} runtime packages).`);
}
