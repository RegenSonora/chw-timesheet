// Validates src/roles/roles.json against schemas/roles.schema.json (decisions 0027, 0029).
import { Ajv2020 } from 'ajv/dist/2020.js';

/**
 * @param {unknown} schema
 * @returns {(data: unknown) => string[]}
 */
export function makeRolesValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(/** @type {object} */ (schema));
  return (data) =>
    validate(data)
      ? []
      : (validate.errors ?? []).map(
          (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`,
        );
}
