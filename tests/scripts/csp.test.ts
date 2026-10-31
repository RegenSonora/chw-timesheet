import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CSP_MARKER, buildPolicy, hashSource, injectCsp } from '../../scripts/lib/csp.mjs';

describe('hashSource', () => {
  it('is the base64 SHA-256 of the exact text', () => {
    const expected = createHash('sha256').update('alert(1)').digest('base64');
    expect(hashSource('alert(1)')).toBe(`'sha256-${expected}'`);
  });
});

describe('buildPolicy', () => {
  it('blocks connections and allows only the given hashes', () => {
    const policy = buildPolicy({ scriptHashes: ["'sha256-a'"], styleHashes: [] });
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'sha256-a'");
    expect(policy).toContain("style-src 'none'");
    expect(policy).not.toContain('unsafe');
  });
});

describe('injectCsp', () => {
  it('hashes every inline script and style', () => {
    const html = `<head>${CSP_MARKER}<style>a{}</style><script type="module">x()</script></head>`;
    const out = injectCsp(html);
    expect(out).toContain(`script-src ${hashSource('x()')}`);
    expect(out).toContain(`style-src ${hashSource('a{}')}`);
    expect(out).not.toContain(CSP_MARKER);
  });

  it('fails when the marker is missing', () => {
    expect(() => injectCsp('<head></head>')).toThrow('CSP marker not found');
  });
});
