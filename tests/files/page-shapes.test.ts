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
    const invoice = await invoiceFrom({ source: { ...tisupp, version: 1 } });
    const files = buildInvoiceFiles(invoice, tisupp);
    expect(await Promise.all(files.map((f) => sha256(f.bytes)))).toEqual([
      '24c1b85d1145e391ef0c3358355f52a32a77972e5193a53dfc306fcdcebb5dce',
      '6efa866b91e9dac673a6b7bd66a471fe4707dd382ac95e50807737418a710ad4',
      'c3e167e974ba2b63a43e67217e13efef14847e1b54fe18cfca2f12b8dd2575ab',
    ]);
  });
});
