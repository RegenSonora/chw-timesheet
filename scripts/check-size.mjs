// Fails when the app files exceed the compressed size budget.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUDGET_FILES, measure } from './lib/size.mjs';

const dist = join(import.meta.dirname, '..', 'dist');
const result = measure(
  BUDGET_FILES.map((name) => ({ name, data: readFileSync(join(dist, name)) })),
);

const kb = (/** @type {number} */ n) => `${(n / 1024).toFixed(1)} KB`;
for (const r of result.rows) {
  console.log(
    `${r.name.padEnd(22)} raw ${kb(r.raw).padStart(9)}  gzip ${kb(r.gzip).padStart(9)}  brotli ${kb(r.brotli).padStart(9)}`,
  );
}
console.log(`Total gzip ${kb(result.total)} of ${kb(result.budget)} budget`);
if (!result.ok) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}
