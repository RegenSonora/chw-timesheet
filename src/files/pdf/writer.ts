// A minimal hand-written PDF 1.4 writer (CLAUDE.md "Dependencies"): pages with text in the
// built-in Helvetica fonts, lines, rectangles and filled squares. Text stays selectable because
// it is real text in WinAnsiEncoding. Output is deterministic: same calls, same bytes.
import { textWidth, toWinAnsi, type FontName } from './fonts';

/** Letter, in points. */
export const LETTER = { width: 612, height: 792 } as const;
export const LETTER_LANDSCAPE = { width: 792, height: 612 } as const;

/** 0 = black, 1 = white. */
export type Gray = number;

export interface TextStyle {
  font?: FontName;
  size: number;
  gray?: Gray;
  align?: 'left' | 'right';
}

export interface StrokeStyle {
  width?: number;
  gray?: Gray;
  dash?: number;
}

const FONT_RESOURCE: Record<FontName, string> = { regular: 'F1', bold: 'F2' };

/** A number for a content stream: at most 3 decimals, no exponent, no "-0". */
function num(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`Not a finite number: ${String(n)}`);
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function hex(codes: readonly number[]): string {
  return `<${codes.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}>`;
}

/** UTF-16BE with byte-order mark, for document info strings. */
function infoString(text: string): string {
  const codes = [0xfe, 0xff];
  for (let i = 0; i < text.length; i++) {
    const u = text.charCodeAt(i);
    codes.push(u >> 8, u & 0xff);
  }
  return hex(codes);
}

/** One page. Coordinates are in points from the top-left corner; y grows downward. */
export class PdfPage {
  readonly ops: string[] = [];

  constructor(
    readonly width: number,
    readonly height: number,
  ) {}

  /** Text on one line with its baseline at y. Right-aligned text ends at x. */
  text(x: number, y: number, text: string, style: TextStyle): void {
    if (!text) return;
    const font = style.font ?? 'regular';
    const left = style.align === 'right' ? x - textWidth(text, font, style.size) : x;
    this.ops.push(
      `BT /${FONT_RESOURCE[font]} ${num(style.size)} Tf ${num(style.gray ?? 0)} g ` +
        `${num(left)} ${num(this.height - y)} Td ${hex(toWinAnsi(text))} Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, style: StrokeStyle = {}): void {
    this.ops.push(
      `${this.strokeState(style)} ${num(x1)} ${num(this.height - y1)} m ` +
        `${num(x2)} ${num(this.height - y2)} l S Q`,
    );
  }

  /** A rectangle from its top-left corner. */
  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    style: StrokeStyle & { fill?: Gray; stroke?: boolean } = {},
  ): void {
    const box = `${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re`;
    const fill = style.fill;
    const stroke = style.stroke ?? fill === undefined;
    const paint = fill !== undefined && stroke ? 'B' : fill !== undefined ? 'f' : 'S';
    const fillOp = fill !== undefined ? `${num(fill)} g ` : '';
    this.ops.push(`${this.strokeState(style)} ${fillOp}${box} ${paint} Q`);
  }

  /** Dark modules as filled squares, merged into runs per row. Top-left at (x, y). */
  modules(x: number, y: number, cell: number, matrix: readonly (readonly boolean[])[]): void {
    const boxes: string[] = [];
    matrix.forEach((row, r) => {
      let c = 0;
      while (c < row.length) {
        if (!row[c]) {
          c++;
          continue;
        }
        const start = c;
        while (c < row.length && row[c]) c++;
        const top = this.height - y - (r + 1) * cell;
        boxes.push(
          `${num(x + start * cell)} ${num(top)} ${num((c - start) * cell)} ${num(cell)} re`,
        );
      }
    });
    this.ops.push(`q 0 g ${boxes.join(' ')} f Q`);
  }

  private strokeState(style: StrokeStyle): string {
    const dash = style.dash ? `[${num(style.dash)} ${num(style.dash)}] 0 d ` : '';
    return `q ${num(style.width ?? 1)} w ${num(style.gray ?? 0)} G ${dash}`.trimEnd();
  }
}

export interface PdfInfo {
  title: string;
  author: string;
  /** ISO 8601 with offset, e.g. 2026-10-31T16:00:00-07:00. */
  created: string;
}

/** 2026-10-31T16:00:00-07:00 → D:20261031160000-07'00' */
export function pdfDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Not an ISO timestamp with offset: ${iso}`);
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  return `D:${y ?? ''}${mo ?? ''}${d ?? ''}${h ?? ''}${mi ?? ''}${s ?? ''}${sign ?? ''}${oh ?? ''}'${om ?? ''}'`;
}

export class PdfDocument {
  readonly pages: PdfPage[] = [];

  addPage(size: { width: number; height: number }): PdfPage {
    const page = new PdfPage(size.width, size.height);
    this.pages.push(page);
    return page;
  }

  /** The finished file. Every byte is written here; offsets in the xref table are exact. */
  bytes(info: PdfInfo): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };
    const catalog = add('');
    const pagesId = add('');
    const regular = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    );
    const bold = add(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    );
    const date = infoString(pdfDate(info.created));
    const infoId = add(
      `<< /Title ${infoString(info.title)} /Author ${infoString(info.author)} ` +
        `/Producer ${infoString('CHW Time Tracker')} /CreationDate ${date} /ModDate ${date} >>`,
    );
    const pageIds = this.pages.map((page) => {
      const stream = page.ops.join('\n');
      const content = add(`<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`);
      return add(
        `<< /Type /Page /Parent ${String(pagesId)} 0 R ` +
          `/MediaBox [0 0 ${num(page.width)} ${num(page.height)}] ` +
          `/Resources << /Font << /F1 ${String(regular)} 0 R /F2 ${String(bold)} 0 R >> >> ` +
          `/Contents ${String(content)} 0 R >>`,
      );
    });
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${String(pagesId)} 0 R >>`;
    objects[pagesId - 1] =
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] ` +
      `/Count ${String(pageIds.length)} >>`;

    // Everything above is ASCII, so string length is byte length.
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
    out +=
      `trailer\n<< /Size ${String(objects.length + 1)} /Root ${String(catalog)} 0 R ` +
      `/Info ${String(infoId)} 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
    return bytes;
  }
}
