import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUDGET_BYTES, measure } from '../../scripts/lib/size.mjs';

describe('measure', () => {
  it('has a 150 KB budget', () => {
    expect(BUDGET_BYTES).toBe(153_600);
  });

  it('passes small files', () => {
    const result = measure([{ name: 'index.html', data: Buffer.from('a'.repeat(10_000)) }]);
    expect(result.ok).toBe(true);
    expect(result.total).toBeLessThan(10_000);
  });

  it('fails when compressed size is over budget', () => {
    // Random bytes do not compress, so gzip size stays above the raw budget.
    const result = measure([{ name: 'index.html', data: randomBytes(BUDGET_BYTES + 1024) }]);
    expect(result.ok).toBe(false);
    expect(result.total).toBeGreaterThan(BUDGET_BYTES);
  });

  it('sums gzip sizes across files', () => {
    const files = [
      { name: 'a', data: Buffer.from('hello') },
      { name: 'b', data: Buffer.from('world') },
    ];
    const result = measure(files);
    expect(result.total).toBe(result.rows.reduce((sum, r) => sum + r.gzip, 0));
  });
});
