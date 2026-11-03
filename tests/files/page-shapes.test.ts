import { describe, expect, it } from 'vitest';
import { buildInvoiceFiles, invoicePageShapes } from '../../src/files';
import { textWidth } from '../../src/files/pdf/fonts';
import { qrMatrix } from '../../src/files/qr/matrix';
import { qrPayloadV1 } from '../../src/files/qr/payload';
import { countDefs, findTestRole, tisupp } from '../core/fixtures/wireframe-sample';
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
      'CONTRACTOR',
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
    // Re-pinned for roles plan R5: canonical v3, counts by id, "Contractor".
    const invoice = await invoiceFrom({ source: { ...tisupp, version: 1 } });
    const files = buildInvoiceFiles(invoice, tisupp, countDefs);
    expect(await Promise.all(files.map((f) => sha256(f.bytes)))).toEqual([
      '8af15813b953a98a4bf66627af80a128afcb3fd633dd6f31d83d47b315b135ff',
      'ccb797314ac06b0ed91c3c1f0717fe9e580ecf003805726564075ca9b06327b7',
      '7df37ec5cfd89437e1aadf99c71a7f81a622b57b7bc3903353281aad887b1282',
    ]);
  });
});

describe('the timesheet summary page, for an employee (decision 0031)', () => {
  it('shows hours, the pay rate and both signatures, and no amounts', async () => {
    const invoice = await invoiceFrom({ role: findTestRole('chw-te01') });
    const { shapes } = invoicePageShapes(invoice, tisupp);
    const strings = shapes.flatMap((s) => (s.kind === 'text' ? [s.text] : []));
    for (const expected of [
      'TIMESHEET',
      'Timesheet #',
      'Pay rate',
      '$20.00/hr',
      'FROM (EMPLOYEE)',
      'EMPLOYER',
      'Total hours',
      'EMPLOYEE',
      'SUPERVISOR SIGNATURE',
      'Supervisor name',
    ]) {
      expect(strings).toContain(expected);
    }
    expect(strings.filter((t) => t === 'Sign here')).toHaveLength(2);
    expect(strings.filter((t) => t.includes('$'))).toEqual(['$20.00/hr']);
    for (const gone of ['INVOICE', 'Amount due', 'CONTRACT TRACKING', 'Payment date']) {
      expect(strings).not.toContain(gone);
    }
  });
});
