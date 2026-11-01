// Production build: Vite single-file page, service worker, version stamp, CSP.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build as esbuild } from 'esbuild';
import { injectCsp } from './lib/csp.mjs';
import { checkFundingSources } from './lib/funding-sources.mjs';
import { readJson } from './lib/json.mjs';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

// CLAUDE.md rule 6: funding sources are validated at build time.
const sourceProblems = checkFundingSources(root);
if (sourceProblems.length) {
  console.error(`Funding source problems:\n- ${sourceProblems.join('\n- ')}`);
  process.exit(1);
}

const pkg = /** @type {{ version: string }} */ (readJson(join(root, 'package.json')));

function gitSha() {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'local';
  }
}

const version = `${pkg.version}+${gitSha()}`;
process.env['APP_VERSION'] = version;

const { build: viteBuild } = await import('vite');
await viteBuild({ root, logLevel: 'warn' });

// The app shell the service worker caches (SPEC §2 "Offline"): everything in dist/ but itself.
const shell = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) =>
    join(d.parentPath, d.name)
      .slice(dist.length + 1)
      .replaceAll('\\', '/'),
  )
  .filter((f) => f !== 'sw.js')
  .sort();

await esbuild({
  entryPoints: [join(root, 'src', 'sw.ts')],
  outfile: join(dist, 'sw.js'),
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __SHELL__: JSON.stringify(shell),
  },
  banner: { js: `// CHW Time Tracker ${version}` },
  logLevel: 'warning',
});

const indexPath = join(dist, 'index.html');
writeFileSync(indexPath, injectCsp(readFileSync(indexPath, 'utf8')));

console.log(`Built CHW Time Tracker ${version} into dist/`);
