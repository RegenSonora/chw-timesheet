import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/core/canonical';
import {
  CANONICAL_VERSION,
  canonicalForm,
  canonicalFormV1,
  fingerprintOf,
  sha256Hex,
  shortFingerprint,
  verifyFingerprint,
} from '../../src/core/fingerprint';
import type { Invoice } from '../../src/core/types';
import { must } from './fixtures/wireframe-sample';
import golden from './golden/fingerprint-v1.json';

// Pinned forever (CLAUDE.md rule 8). If a test here fails, the canonical form changed:
// add a new canonical version instead of editing this file.
const cases = golden as {
  name: string;
  invoice: Invoice;
  canonical: string;
  fingerprint: string;
}[];

describe('canonicalJson', () => {
  it('sorts keys at every level and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 0, y: null }], c: true } })).toBe(
      '{"a":{"c":true,"d":[3,{"y":null,"z":0}]},"b":1}',
    );
  });

  it('is the same whatever order keys were added in', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it('orders keys by UTF-16 code units', () => {
    expect(canonicalJson({ b: 1, B: 2, é: 3, a: 4 })).toBe('{"B":2,"a":4,"b":1,"é":3}');
  });

  it('escapes strings as JSON does and keeps other characters as UTF-8', () => {
    expect(canonicalJson('a"b\\c\n\u0007é😀')).toBe('"a\\"b\\\\c\\n\\u0007é😀"');
  });

  it('allows safe integers only', () => {
    for (const bad of [1.5, Number.NaN, Infinity, -0, 2 ** 53]) {
      expect(() => canonicalJson({ n: bad }), String(bad)).toThrow();
    }
    expect(canonicalJson([-5, 0, Number.MAX_SAFE_INTEGER])).toBe('[-5,0,9007199254740991]');
  });

  it('rejects undefined and non-plain values', () => {
    for (const bad of [
      undefined,
      { u: undefined },
      new Date(0),
      new Map(),
      1n,
      () => 1,
      Symbol('s'),
    ]) {
      expect(() => canonicalJson(bad)).toThrow();
    }
  });
});

describe('fingerprint v1 golden files', () => {
  it('pins the canonical version', () => {
    expect(CANONICAL_VERSION).toBe(1);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s: canonical form is unchanged', (_, c) => {
    expect(canonicalFormV1(c.invoice)).toBe(c.canonical);
    expect(canonicalForm(c.invoice)).toBe(c.canonical);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s: fingerprint is unchanged', async (_, c) => {
    expect(await sha256Hex(c.canonical)).toBe(c.fingerprint);
    expect(await fingerprintOf(c.invoice)).toBe(c.fingerprint);
    expect(await verifyFingerprint(c.invoice)).toBe(true);
  });

  it('matches an independent SHA-256', async () => {
    // FIPS 180-2 test vector.
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('what the fingerprint covers', () => {
  const base = must(cases[0]).invoice;

  async function changes(edit: (copy: Invoice) => void) {
    const copy = structuredClone(base);
    edit(copy);
    return (await fingerprintOf(copy)) !== base.fingerprint;
  }

  it('changes when any billed fact changes', async () => {
    const edits: ((i: Invoice) => void)[] = [
      (i) => (i.number = 'CC-2026-005'),
      (i) => (i.invoice_date = '2026-11-01'),
      (i) => (i.chw.name = 'Carmen Cruz-Lopez'),
      (i) => (i.rate_cents = 2001),
      (i) => (i.total_cents += 1),
      (i) => (must(i.lines[0]).quarters += 1),
      (i) => (must(i.entries[0]).stop = '2026-10-20T10:31:13-07:00'),
      (i) => (must(i.entries[0]).notes = 'Library table.'),
      (i) => (must(i.entries[0]).counts.contacts += 1),
      (i) => must(i.entries[0]).counts.other.push({ label: 'Food boxes', value: 1 }),
      (i) => i.entries.reverse(),
      (i) => (i.source.version = 2),
    ];
    for (const edit of edits) expect(await changes(edit)).toBe(true);
  });

  it('does not change with the NTE, all-time counts, certification text or timestamps', async () => {
    const edits: ((i: Invoice) => void)[] = [
      (i) => (i.nte = { state: 'not_entered' }),
      (i) => (i.counts_all_time.contacts += 1),
      (i) => (i.source.certification_text = 'x'),
      (i) => (i.updated_at = '2030-01-01T00:00:00-07:00'),
    ];
    for (const edit of edits) expect(await changes(edit)).toBe(false);
  });

  it('refuses an unknown canonical version', () => {
    expect(() => canonicalForm({ ...base, canonical_version: 2 })).toThrow();
  });
});

describe('shortFingerprint', () => {
  it('prints the first 8 hex characters as XXXX-XXXX', () => {
    expect(shortFingerprint(`3f9a21c7${'0'.repeat(56)}`)).toBe('3F9A-21C7');
  });

  it('rejects anything that is not a full fingerprint', () => {
    expect(() => shortFingerprint('3f9a21c7')).toThrow();
    expect(() => shortFingerprint('G'.repeat(64))).toThrow();
  });
});
