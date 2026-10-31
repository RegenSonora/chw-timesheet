// Validates funding source files against schemas/funding-source.schema.json (CLAUDE.md rule 6).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readJson } from './json.mjs';

/** @typedef {{ id: string, name: string }} Named */

/**
 * @param {unknown} schema
 * @returns {(data: unknown) => string[]}
 */
export function makeValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(/** @type {object} */ (schema));
  return (data) => {
    if (!validate(data)) {
      return (validate.errors ?? []).map(
        (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
      );
    }
    // Rules the schema can't express: ids and names unique within each list.
    const source = /** @type {{ tasks: Named[], budget_lines: Named[] }} */ (data);
    return [
      ...duplicates('tasks', source.tasks),
      ...duplicates('budget_lines', source.budget_lines),
    ];
  };
}

/**
 * @param {string} list
 * @param {Named[]} items
 */
function duplicates(list, items) {
  /** @type {string[]} */
  const problems = [];
  for (const key of /** @type {const} */ (['id', 'name'])) {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item[key])) problems.push(`/${list} has duplicate ${key} "${item[key]}"`);
      seen.add(item[key]);
    }
  }
  return problems;
}

/**
 * Check every source file. Each file must be named `<id>.json`; ids and codes are unique across files.
 * @param {string} root repository root
 * @returns {string[]} problems, each prefixed with its file name
 */
export function checkFundingSources(root) {
  const validate = makeValidator(readJson(join(root, 'schemas', 'funding-source.schema.json')));
  const dir = join(root, 'src', 'funding-sources');
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  /** @type {string[]} */
  const problems = [];
  if (files.length === 0) problems.push('src/funding-sources has no source files');
  const ids = new Set();
  const codes = new Set();
  for (const file of files) {
    let data;
    try {
      data = readJson(join(dir, file));
    } catch (error) {
      problems.push(`${file}: not valid JSON (${String(error)})`);
      continue;
    }
    const fileProblems = validate(data);
    problems.push(...fileProblems.map((p) => `${file}: ${p}`));
    if (fileProblems.length) continue;
    const { id, code } = /** @type {{ id: string, code: string }} */ (data);
    if (file !== `${id}.json`) problems.push(`${file}: file name must be ${id}.json`);
    if (ids.has(id)) problems.push(`${file}: duplicate source id "${id}"`);
    if (codes.has(code)) problems.push(`${file}: duplicate source code "${code}"`);
    ids.add(id);
    codes.add(code);
  }
  return problems;
}
