// Fails when a funding source file does not match schemas/funding-source.schema.json.
import { join } from 'node:path';
import { checkFundingSources } from './lib/funding-sources.mjs';

const problems = checkFundingSources(join(import.meta.dirname, '..'));
if (problems.length) {
  console.error(`Funding source problems:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Funding source files are valid.');
