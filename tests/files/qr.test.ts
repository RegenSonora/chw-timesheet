import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix } from '../../src/files/qr/matrix';
import { QR_PAYLOAD_VERSION, qrPayloadV1 } from '../../src/files/qr/payload';
import { makeEntry, regen } from '../core/fixtures/wireframe-sample';
import { invoiceFrom, sampleInvoice } from './helpers';

/** Render modules to RGBA pixels with a 4-module quiet zone, as a scanner would see them. */
function decode(matrix: boolean[][], scale = 4): string | null {
  const quiet = 4;
  const size = (matrix.length + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (!dark) return;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    });
  });
  return jsQR(pixels, size, size)?.data ?? null;
}

describe('QR payload v1 (decision 0011)', () => {
  it('is pinned for the wireframe sample', async () => {
    const invoice = await sampleInvoice();
    expect(QR_PAYLOAD_VERSION).toBe(1);
    expect(qrPayloadV1(invoice)).toBe(
      '{"v":1,"n":"CC-2026-004","p":["2026-10-20","2026-10-30"],' +
        '"l":[["new-chws",12,6000],["chw-referrals",13,6500],["outreach-and-marketing",12,6000]],' +
        `"f":"${invoice.fingerprint}"}`,
    );
  });

  it('is valid JSON with integers only', async () => {
    const parsed = JSON.parse(qrPayloadV1(await sampleInvoice())) as { l: number[][] };
    expect(
      parsed.l
        .flat()
        .filter((x) => typeof x === 'number')
        .every(Number.isInteger),
    ).toBe(true);
  });
});

describe('qrMatrix', () => {
  it('decodes back to the payload', async () => {
    const payload = qrPayloadV1(await sampleInvoice());
    expect(decode(qrMatrix(payload))).toBe(payload);
  });

  it('fits and decodes an invoice with every REGEN-GO budget line', async () => {
    const entries = regen.budget_lines.map((line, i) =>
      makeEntry(
        `2026-10-${String(i + 1).padStart(2, '0')}`,
        '09:00:00',
        '17:00:00',
        'outreach',
        line.id,
        {
          source_id: regen.id,
        },
      ),
    );
    const invoice = await invoiceFrom({
      source: regen,
      settings: { source_id: regen.id, rate_cents: 2237, nte_cents: null },
      entries,
      prior_invoices: [],
    });
    expect(invoice.lines).toHaveLength(13);
    const payload = qrPayloadV1(invoice);
    const matrix = qrMatrix(payload);
    expect(matrix.length).toBeLessThanOrEqual(97); // version 20
    expect(decode(matrix)).toBe(payload);
  });

  it('refuses text outside printable ASCII', () => {
    expect(() => qrMatrix('café')).toThrow();
  });
});
