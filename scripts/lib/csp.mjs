import { createHash } from 'node:crypto';

/** Marker in index.html that the build replaces with the CSP meta tag. */
export const CSP_MARKER =
  '<!-- CSP: replaced at build time by scripts/build.mjs with script and style hashes. -->';

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/**
 * CSP source expression for an inline block, hashed exactly as the browser sees it.
 * @param {string} text
 */
export function hashSource(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

/**
 * The policy (CLAUDE.md rule 2): nothing loads or connects anywhere except this origin's own
 * manifest, icons and service worker; inline code runs only if its hash matches.
 * @param {{ scriptHashes: string[], styleHashes: string[] }} hashes
 */
export function buildPolicy({ scriptHashes, styleHashes }) {
  const list = (/** @type {string[]} */ items) => (items.length ? items.join(' ') : "'none'");
  return [
    "default-src 'none'",
    `script-src ${list(scriptHashes)}`,
    `style-src ${list(styleHashes)}`,
    "img-src 'self' data: blob:",
    "connect-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "font-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Replace the CSP marker in built HTML with a meta tag that allows exactly its inline blocks.
 * @param {string} html
 */
export function injectCsp(html) {
  if (!html.includes(CSP_MARKER)) throw new Error('CSP marker not found in index.html');
  const scriptHashes = [...html.matchAll(INLINE_SCRIPT)]
    .filter((m) => !/\bsrc\s*=/i.test(m[1] ?? ''))
    .map((m) => hashSource(m[2] ?? ''));
  const styleHashes = [...html.matchAll(INLINE_STYLE)].map((m) => hashSource(m[1] ?? ''));
  const policy = buildPolicy({
    scriptHashes: [...new Set(scriptHashes)],
    styleHashes: [...new Set(styleHashes)],
  });
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
  return html.replace(CSP_MARKER, meta);
}
