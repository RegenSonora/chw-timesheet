// Canonical JSON for fingerprints (CLAUDE.md rule 8): sorted keys, no whitespace, integers only.
// Changing this output changes every fingerprint; fingerprint.ts pins it per canonical version.

/** Serialize plain data canonically. Throws on floats, -0, unsafe integers, undefined and non-plain objects. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(`Canonical JSON allows safe integers only, got ${String(value)}`);
    }
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError('Canonical JSON allows plain objects only');
    }
    const record = value as Record<string, unknown>;
    // Default sort compares UTF-16 code units, the same in every JavaScript engine.
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
  }
  throw new TypeError(`Canonical JSON can't hold ${typeof value}`);
}
