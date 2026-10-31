// Runs every CI check in order, except e2e (pnpm test:e2e).
import { spawnSync } from 'node:child_process';

const steps = [
  'lint',
  'format:check',
  'typecheck',
  'test',
  'build',
  'check:dist',
  'check:size',
  'licenses:check',
];

for (const step of steps) {
  console.log(`\n> pnpm ${step}`);
  // One command string (steps are fixed names) so pnpm resolves on Windows without DEP0190.
  const result = spawnSync(`pnpm run ${step}`, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\nStep failed: ${step}`);
    process.exit(result.status ?? 1);
  }
}
console.log('\nAll checks passed.');
