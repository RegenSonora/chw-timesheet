import { readFileSync } from 'node:fs';

/**
 * Read a JSON file as `unknown`, so callers state the shape they expect.
 * @param {string} path
 * @returns {unknown}
 */
export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
