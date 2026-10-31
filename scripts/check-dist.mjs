// Fails when dist/ is not one self-contained index.html plus sw.js, manifest and icons.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkFiles, checkHtml, localReferences } from './lib/dist-check.mjs';

const dist = join(import.meta.dirname, '..', 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Run pnpm build first.');
  process.exit(1);
}

const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => relative(dist, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const errors = [
  ...checkFiles(files),
  ...checkHtml(html),
  ...localReferences(html)
    .filter((ref) => !files.includes(ref))
    .map((ref) => `index.html links to missing file: ${ref}`),
];

if (errors.length) {
  console.error(`dist/ check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`dist/ check passed (${String(files.length)} files).`);
