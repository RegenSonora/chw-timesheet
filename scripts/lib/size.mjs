import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

/** CLAUDE.md bundle budget: 150 KB compressed (gzip), app files only, icons excluded. */
export const BUDGET_BYTES = 150 * 1024;

/** dist/ files counted against the budget. */
export const BUDGET_FILES = ['index.html', 'sw.js', 'manifest.webmanifest'];

/**
 * @param {Buffer} data
 */
export function gzipSize(data) {
  return gzipSync(data, { level: 9 }).length;
}

/**
 * @param {Buffer} data
 */
export function brotliSize(data) {
  return brotliCompressSync(data, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length;
}

/**
 * @param {{ name: string, data: Buffer }[]} files
 */
export function measure(files) {
  const rows = files.map(({ name, data }) => ({
    name,
    raw: data.length,
    gzip: gzipSize(data),
    brotli: brotliSize(data),
  }));
  const total = rows.reduce((sum, r) => sum + r.gzip, 0);
  return { rows, total, budget: BUDGET_BYTES, ok: total <= BUDGET_BYTES };
}
