// Checks for CLAUDE.md rules 1 and 2: one self-contained index.html, nothing remote, nothing extra.

/** Files allowed in dist/ (paths use forward slashes). */
export const ALLOWED_FILES = [
  /^index\.html$/,
  /^sw\.js$/,
  /^manifest\.webmanifest$/,
  /^icons\/[\w-]+\.png$/,
];

/** `<link rel>` values index.html may use; all must point at local files. */
const ALLOWED_LINK_RELS = new Set(['manifest', 'icon', 'apple-touch-icon']);

const REMOTE_URL = /^\s*(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * @param {string} tag
 * @param {string} name
 */
function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/**
 * Problems with a built index.html. Empty array means it passes.
 * @param {string} html
 * @returns {string[]}
 */
export function checkHtml(html) {
  /** @type {string[]} */
  const errors = [];

  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (attr(tag, 'src') !== null) errors.push(`External script: ${tag}`);
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (!ALLOWED_LINK_RELS.has(rel)) errors.push(`Link not allowed (rel="${rel}"): ${tag}`);
  }

  for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) {
    for (const name of ['src', 'href', 'srcset', 'poster', 'data', 'action']) {
      const value = attr(tag, name);
      if (value !== null && REMOTE_URL.test(value)) errors.push(`Remote URL in ${name}: ${tag}`);
    }
  }

  for (const [, css] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (/@import\b/i.test(css ?? '')) errors.push('CSS @import in inline style');
    for (const [, url] of (css ?? '').matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
      if (REMOTE_URL.test(url ?? '')) errors.push(`Remote URL in CSS: ${url ?? ''}`);
    }
  }

  errors.push(...checkCsp(html));
  return errors;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
function checkCsp(html) {
  const metas = [
    ...html.matchAll(/<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy[^>]*>/gi),
  ];
  if (metas.length !== 1) return [`Expected one CSP meta tag, found ${String(metas.length)}`];
  const meta = metas[0];
  if (!meta) return [];
  /** @type {string[]} */
  const errors = [];
  const policy = attr(meta[0], 'content') ?? '';
  const directives = new Map(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map((parts) => [parts[0]?.toLowerCase() ?? '', parts.slice(1)]),
  );
  const expectNone = ['default-src', 'connect-src', 'object-src', 'base-uri'];
  for (const name of expectNone) {
    const value = directives.get(name);
    if (value?.join(' ') !== "'none'") errors.push(`CSP must set ${name} 'none'`);
  }
  for (const name of ['script-src', 'style-src']) {
    const sources = directives.get(name);
    if (!sources) {
      errors.push(`CSP missing ${name}`);
      continue;
    }
    for (const source of sources) {
      if (source !== "'none'" && !/^'sha256-[A-Za-z0-9+/=]+'$/.test(source)) {
        errors.push(`CSP ${name} allows ${source}; only hashes are allowed`);
      }
    }
  }
  const firstCode = html.search(/<(script|style)\b/i);
  if (firstCode !== -1 && meta.index > firstCode)
    errors.push('CSP meta must come before any script or style');
  return errors;
}

/**
 * Problems with the list of files in dist/. Empty array means it passes.
 * @param {string[]} files paths relative to dist/
 * @returns {string[]}
 */
export function checkFiles(files) {
  const normalized = files.map((f) => f.replaceAll('\\', '/'));
  /** @type {string[]} */
  const errors = normalized
    .filter((f) => !ALLOWED_FILES.some((re) => re.test(f)))
    .map((f) => `File not allowed in dist/: ${f}`);
  for (const required of ['index.html', 'sw.js', 'manifest.webmanifest']) {
    if (!normalized.includes(required)) errors.push(`Missing dist/${required}`);
  }
  return errors;
}

/**
 * Local files that index.html links to (manifest, icons), relative to dist/.
 * @param {string} html
 */
export function localReferences(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => attr(tag, 'href'))
    .filter((href) => href !== null && !REMOTE_URL.test(href))
    .map((href) => (href ?? '').replace(/^\.\//, ''));
}
