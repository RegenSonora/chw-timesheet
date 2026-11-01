import { describe, expect, it } from 'vitest';
import { fitText, textWidth, toWinAnsi, wrapLines, wrapText } from '../../src/files/pdf/fonts';
import { LETTER, LETTER_LANDSCAPE, PdfDocument, pdfDate } from '../../src/files/pdf/writer';
import { readPdf } from './pdf-reader';

const info = {
  title: 'Invoice CC-2026-004',
  author: 'Carmen Cruz',
  created: '2026-10-31T16:00:00-07:00',
};

/** Parentheses and a backslash would need escaping in literal strings; the rest is WinAnsi above 127. */
const TRICKY = String.raw`Café (niño) \ back – “quoted” ’s`;

function sample(): Uint8Array {
  const doc = new PdfDocument();
  const p1 = doc.addPage(LETTER);
  p1.text(40, 60, 'INVOICE', { font: 'bold', size: 22 });
  p1.text(40, 90, TRICKY, { size: 10 });
  p1.text(572, 120, '$185.00', { size: 10, align: 'right' });
  p1.line(40, 130, 572, 130, { width: 1.5 });
  p1.rect(40, 140, 100, 40, { dash: 3, gray: 0.5 });
  p1.rect(40, 200, 100, 40, { fill: 0.95, stroke: false });
  p1.modules(40, 260, 2, [
    [true, false, true],
    [true, true, false],
  ]);
  doc.addPage(LETTER_LANDSCAPE).text(36, 50, 'Timesheet 😀', { size: 18 });
  return doc.bytes(info);
}

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes);

describe('PDF writer', () => {
  it('opens in a PDF reader with the right pages and selectable text', async () => {
    const pages = await readPdf(sample());
    expect(pages.map((p) => [p.width, p.height])).toEqual([
      [612, 792],
      [792, 612],
    ]);
    expect(pages[0]?.items).toEqual(['INVOICE', TRICKY, '$185.00']);
    expect(pages[1]?.text).toBe('Timesheet ?');
  });

  it('writes an xref table whose offsets point at each object', () => {
    const text = latin1(sample());
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((m, i) => {
      expect(text.slice(Number(m[1])).startsWith(`${String(i + 1)} 0 obj\n`)).toBe(true);
    });
  });

  it('gives each content stream its exact length', () => {
    const text = latin1(sample());
    for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index + m[0].length;
      expect(text.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe('\nendstream');
    }
  });

  it('is deterministic', () => {
    expect(sample()).toEqual(sample());
  });

  it('formats PDF dates', () => {
    expect(pdfDate('2026-10-31T16:00:00-07:00')).toBe("D:20261031160000-07'00'");
  });
});

describe('fonts', () => {
  it('maps text to WinAnsi, with ? for what Helvetica cannot show', () => {
    expect(toWinAnsi('Aé–’…€\n😀ā')).toEqual([
      0x41, 0xe9, 0x96, 0x92, 0x85, 0x80, 0x20, 0x3f, 0x3f,
    ]);
  });

  it('measures with AFM widths', () => {
    expect(textWidth('A', 'regular', 1000)).toBe(667);
    expect(textWidth('A', 'bold', 1000)).toBe(722);
    expect(textWidth('Hello', 'regular', 10)).toBeCloseTo(22.78, 2);
  });

  it('wraps at spaces and inside long words', () => {
    expect(wrapText('one two three', 'regular', 10, 40)).toEqual(['one two', 'three']);
    expect(wrapText('', 'regular', 10, 40)).toEqual([]);
    const pieces = wrapText('x'.repeat(30), 'regular', 10, 40);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join('')).toBe('x'.repeat(30));
    expect(wrapText('a\nb', 'regular', 10, 400)).toEqual(['a', 'b']);
  });

  it('cuts text with an ellipsis', () => {
    expect(fitText('short', 'regular', 10, 100)).toBe('short');
    const cut = fitText('a long line of notes that will not fit', 'regular', 10, 60);
    expect(cut.endsWith('…')).toBe(true);
    expect(textWidth(cut, 'regular', 10)).toBeLessThanOrEqual(60);
    const lines = wrapLines('one two three four five six', 'regular', 10, 40, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('…')).toBe(true);
  });
});
