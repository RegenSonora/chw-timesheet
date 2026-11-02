import { describe, expect, it } from 'vitest';
import { buildInvoiceFiles, invoicePageShapes } from '../../src/files';
import { textWidth } from '../../src/files/pdf/fonts';
import { qrMatrix } from '../../src/files/qr/matrix';
import { qrPayloadV1 } from '../../src/files/qr/payload';
import { tisupp } from '../core/fixtures/wireframe-sample';
import { invoiceFrom, sampleInvoice } from './helpers';

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('page 1 as shapes, for the picture (decision 0018)', () => {
  it('is a Letter page', async () => {
    const page = invoicePageShapes(await sampleInvoice(), tisupp);
    expect([page.width, page.height]).toEqual([612, 792]);
  });

  it('holds the same text as the PDF page 1, with Helvetica widths', async () => {
    const invoice = await sampleInvoice();
    const { shapes } = invoicePageShapes(invoice, tisupp);
    const texts = shapes.flatMap((s) => (s.kind === 'text' ? [s] : []));
    const strings = texts.map((t) => t.text);
    for (const expected of [
      'INVOICE',
      'Carmen Cruz',
      'CONTRACTOR (CHW)',
      'SERVICES RECEIVED (REVIEWER)',
      'CC-2026-004 · Page 1 of 3',
    ]) {
      expect(strings).toContain(expected);
    }
    expect(strings.filter((t) => t === 'Sign here')).toHaveLength(2);
    for (const t of texts) expect(t.width).toBeCloseTo(textWidth(t.text, t.font, t.size), 6);
  });

  it('right-aligned text ends at its anchor', async () => {
    const { shapes } = invoicePageShapes(await sampleInvoice(), tisupp);
    const page = shapes.find((s) => s.kind === 'text' && s.text.startsWith('CC-2026-004 · Page'));
    if (page?.kind !== 'text') throw new Error('no page number');
    expect(page.x + page.width).toBeCloseTo(612 - 48, 6);
  });

  it('carries the QR code that the PDF prints', async () => {
    const invoice = await sampleInvoice();
    const { shapes } = invoicePageShapes(invoice, tisupp);
    const qr = shapes.find((s) => s.kind === 'modules');
    if (qr?.kind !== 'modules') throw new Error('no QR code');
    expect(qr.matrix).toEqual(qrMatrix(qrPayloadV1(invoice)));
  });

  it('has lines, boxes and the shaded certification', async () => {
    const { shapes } = invoicePageShapes(await sampleInvoice(), tisupp);
    expect(shapes.some((s) => s.kind === 'line')).toBe(true);
    expect(shapes.some((s) => s.kind === 'rect' && s.dash !== undefined)).toBe(true);
    expect(shapes.some((s) => s.kind === 'rect' && s.fill !== undefined && !s.stroke)).toBe(true);
  });

  it('leaves the PDF and CSV bytes as they were', async () => {
    // Pinned at TISUPP version 1, so a later edit to the source file doesn't move the hashes.
    // Re-pinned for decision 0024: the fingerprint (canonical v2) and the entry log's part column.
    const invoice = await invoiceFrom({ source: { ...tisupp, version: 1 } });
    const files = buildInvoiceFiles(invoice, tisupp);
    expect(await Promise.all(files.map((f) => sha256(f.bytes)))).toEqual([
      'bebf672b438d9702f31c4962d9524ffb1bee016c1f4719335d5eff300aba539a',
      'cfbd31327e42b3015ac01726defcdc57c7122f1ac945fd88fad84741da7ad6fe',
      '6ef3b112d3f2df47fe9371ae2ba10f172cd4a8afdc1f60dd51059f97da545289',
    ]);
  });
});
