// Validates src/roles/roles.json against schemas/roles.schema.json, then against the funding source
// files (roles plan R1, decisions 0027–0033). Every problem names the role and field in plain words.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { isRealDate } from './funding-sources.mjs';
import { readJson } from './json.mjs';

/**
 * @typedef {{ id: string, count_ids: string[] }} RoleTask
 * @typedef {{ id: string, tasks: RoleTask[] }} RoleLine
 * @typedef {{ source_id: string, nte_cents?: number, ends?: string, budget_lines: RoleLine[] }} Funding
 * @typedef {{ id: string, code: string, employment: string, chw: boolean,
 *   certification_step?: object, employee_certification_text?: string,
 *   retired?: true, replaced_by?: string, funding: Funding[] }} Role
 * @typedef {{ id: string, label: string, retired?: true }} Count
 * @typedef {{ counts: Count[], roles: Role[] }} RolesFile
 * @typedef {{ id: string, code: string, has_nte: boolean, period_start: string | null,
 *   period_end: string | null, employee_certification_text?: string,
 *   tasks: { id: string }[], budget_lines: { id: string }[] }} Source
 */

/**
 * Schema problems, with paths inside a role named by its code: "role R-TL01: funding 1 budget_lines
 * is empty".
 * @param {unknown} schema
 * @returns {(data: unknown) => string[]}
 */
export function makeRolesValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(/** @type {object} */ (schema));
  return (data) => {
    if (validate(data)) return [];
    const { roles } = /** @type {{ roles?: unknown }} */ (data);
    return (validate.errors ?? []).map((error) => {
      const message = error.keyword === 'minItems' ? 'is empty' : (error.message ?? 'is invalid');
      const [, list, index, ...rest] = error.instancePath.split('/');
      const field = rest.map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : p)).join(' ');
      if (list === 'roles' && index !== undefined && Array.isArray(roles)) {
        const role = /** @type {unknown[]} */ (roles)[Number(index)];
        const code = /** @type {{ code?: unknown } | undefined} */ (role)?.code;
        const name = typeof code === 'string' ? code : `#${String(Number(index) + 1)}`;
        return `role ${name}: ${field ? `${field} ` : ''}${message}`;
      }
      return `${error.instancePath || '/'} ${message}`;
    });
  };
}

/** Letter case and spaces don't make a count label different (decision 0029). */
const sameLabel = (/** @type {string} */ label) => label.toLowerCase().replace(/\s+/g, '');

/**
 * @param {string[]} problems
 * @param {string} where
 * @param {string} what
 * @param {string[]} ids
 */
function listedTwice(problems, where, what, ids) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) problems.push(`${where}: ${what} "${id}" is listed twice`);
    seen.add(id);
  }
}

/**
 * Check a roles file against the funding source files.
 * @param {unknown} data roles file contents
 * @param {unknown[]} sourceFiles funding source file contents, already valid
 * @param {unknown} schema schemas/roles.schema.json
 * @returns {string[]} problems
 */
export function checkRolesData(data, sourceFiles, schema) {
  const schemaProblems = makeRolesValidator(schema)(data);
  if (schemaProblems.length) return schemaProblems;
  const file = /** @type {RolesFile} */ (data);
  const sources = new Map(
    /** @type {Source[]} */ (sourceFiles).map((source) => [source.id, source]),
  );
  /** @type {string[]} */
  const problems = [];

  // Counts: ids and labels unique, retired ones included.
  /** @type {Map<string, Count>} */
  const counts = new Map();
  /** @type {Map<string, Count>} */
  const labels = new Map();
  for (const count of file.counts) {
    if (counts.has(count.id)) problems.push(`count "${count.id}": id is used more than once`);
    else counts.set(count.id, count);
    const other = labels.get(sameLabel(count.label));
    if (other && other.id !== count.id) {
      problems.push(`count "${count.id}": label "${count.label}" matches count "${other.id}"`);
    } else labels.set(sameLabel(count.label), count);
  }

  // Role ids and codes unique, retired ones included.
  /** @type {Map<string, Role>} */
  const roles = new Map();
  const codes = new Set();
  for (const role of file.roles) {
    const first = roles.get(role.id);
    if (first)
      problems.push(`role ${role.code}: id "${role.id}" is already used by role ${first.code}`);
    else roles.set(role.id, role);
    if (codes.has(role.code))
      problems.push(`role ${role.code}: code is used by more than one role`);
    codes.add(role.code);
  }

  for (const role of file.roles) {
    const at = `role ${role.code}`;
    if (role.certification_step && !role.chw) {
      problems.push(`${at}: certification_step is only for CHW roles (chw: true)`);
    }
    problems.push(...replacementProblems(role, roles));

    listedTwice(
      problems,
      at,
      'funding',
      role.funding.map((f) => f.source_id),
    );
    for (const funding of role.funding) {
      const source = sources.get(funding.source_id);
      if (!source) {
        problems.push(`${at}: funding source "${funding.source_id}" doesn't exist`);
        continue;
      }
      const atSource = `${at}, funding ${source.id}`;
      if (funding.nte_cents !== undefined && !source.has_nte) {
        problems.push(`${atSource}: nte_cents is set but ${source.code} has no NTE`);
      }
      if (funding.ends !== undefined)
        problems.push(...endsProblems(atSource, funding.ends, source));
      if (
        role.employment === 'employee' &&
        source.employee_certification_text === undefined &&
        role.employee_certification_text === undefined
      ) {
        problems.push(
          `${atSource}: employee role, but ${source.code} has no employee_certification_text and the role doesn't set one`,
        );
      }

      const lineIds = new Set(source.budget_lines.map((l) => l.id));
      const taskIds = new Set(source.tasks.map((t) => t.id));
      listedTwice(
        problems,
        atSource,
        'budget line',
        funding.budget_lines.map((l) => l.id),
      );
      for (const line of funding.budget_lines) {
        if (!lineIds.has(line.id)) {
          problems.push(`${atSource}: budget line "${line.id}" isn't in ${source.code}`);
        }
        const atLine = `${atSource}, budget line ${line.id}`;
        listedTwice(
          problems,
          atLine,
          'task',
          line.tasks.map((t) => t.id),
        );
        for (const task of line.tasks) {
          if (!taskIds.has(task.id)) {
            problems.push(`${atLine}: task "${task.id}" isn't in ${source.code}`);
          }
          const atTask = `${atLine}, task ${task.id}`;
          listedTwice(problems, atTask, 'count', task.count_ids);
          for (const id of new Set(task.count_ids)) {
            const count = counts.get(id);
            if (!count) problems.push(`${atTask}: count "${id}" isn't in the count list`);
            else if (count.retired && !role.retired)
              problems.push(`${atTask}: count "${id}" is retired`);
          }
        }
      }
    }
  }
  return problems;
}

/**
 * replaced_by only on a retired role, pointing to an existing active role, with no loop.
 * @param {Role} role
 * @param {Map<string, Role>} roles
 */
function replacementProblems(role, roles) {
  const at = `role ${role.code}`;
  if (role.replaced_by === undefined) return [];
  if (!role.retired) return [`${at}: replaced_by is set but the role isn't retired`];
  const path = [role.id];
  /** @type {Role | undefined} */
  let next = roles.get(role.replaced_by);
  if (!next) return [`${at}: replaced_by "${role.replaced_by}" doesn't exist`];
  /** @type {string[]} */
  const problems = [];
  if (next.retired) problems.push(`${at}: replaced_by "${next.id}" is retired`);
  while (next?.retired && next.replaced_by !== undefined) {
    path.push(next.id);
    if (next.id === role.id || path.indexOf(next.id) !== path.length - 1) {
      problems.push(`${at}: replaced_by forms a loop: ${path.join(' → ')}`);
      break;
    }
    next = roles.get(next.replaced_by);
  }
  return problems;
}

/**
 * A funding entry's last day must be a real date inside its source's period (decision 0033).
 * @param {string} at
 * @param {string} ends
 * @param {Source} source
 */
function endsProblems(at, ends, source) {
  if (!isRealDate(ends)) return [`${at}: ends ${ends} isn't a real date`];
  const start = source.period_start;
  const end = source.period_end;
  if ((start !== null && ends < start) || (end !== null && ends > end)) {
    const period = `${start ?? 'no start'} to ${end ?? 'no end'}`;
    return [`${at}: ends ${ends} is outside ${source.code}'s period (${period})`];
  }
  return [];
}

/**
 * Check src/roles/roles.json against the schema and the funding source files.
 * @param {string} root repository root
 * @returns {string[]} problems, each prefixed with "roles.json: "
 */
export function checkRoles(root) {
  const dir = join(root, 'src', 'funding-sources');
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(join(dir, name)));
  let data;
  try {
    data = readJson(join(root, 'src', 'roles', 'roles.json'));
  } catch (error) {
    return [`roles.json: not valid JSON (${String(error)})`];
  }
  const schema = readJson(join(root, 'schemas', 'roles.schema.json'));
  return checkRolesData(data, sources, schema).map((p) => `roles.json: ${p}`);
}
