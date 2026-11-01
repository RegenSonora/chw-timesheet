// PDF page 1, the invoice (SPEC §7 "PDF page 1", wireframe PdfInvoice). Laid out top to bottom
// at a scale; when a long invoice doesn't fit, it is drawn again smaller.
import { COUNT_FIELDS } from '../../core/counts';
import { shortFingerprint } from '../../core/fingerprint';
import { formatDollars, formatQuarters } from '../../core/money';
import type { Counts, Invoice } from '../../core/types';
import { qrMatrix } from '../qr/matrix';
import { qrPayloadV1 } from '../qr/payload';
import { dateRange, longDate } from '../text';
import { fitText, textWidth, wrapLines, wrapText, type FontName } from './fonts';
import { LETTER, PdfPage, type Gray } from './writer';

/** Who the invoice is billed to (SPEC §7). The same for every funding source. */
export const BILL_TO = ['Regenerating Sonora, Inc.', 'PO Box 154', 'Superior, AZ 85173'] as const;

const MARGIN = 48;
const LEFT = MARGIN;
const RIGHT = LETTER.width - MARGIN;
const WIDTH = RIGHT - LEFT;
const BOTTOM = LETTER.height - 36;
const INK: Gray = 0.1;
const MUTED: Gray = 0.3;
const RULE: Gray = 0.75;
/** Custom counts listed on page 1; the rest are in the entry log CSV. */
const OTHER_COUNTS_SHOWN = 6;
const ADDRESS_LINES = 4;

interface Ctx {
  page: PdfPage;
  /** Scale for type and vertical space; 1 is the design size. */
  k: number;
}

function text(
  c: Ctx,
  x: number,
  y: number,
  s: string,
  size: number,
  font: FontName = 'regular',
  gray: Gray = INK,
  align: 'left' | 'right' = 'left',
) {
  c.page.text(x, y, s, { size: size * c.k, font, gray, align });
}

/** Small caps-style section label. */
function caption(c: Ctx, x: number, y: number, s: string, maxWidth: number) {
  text(c, x, y, fitText(s.toUpperCase(), 'bold', 7.5 * c.k, maxWidth), 7.5, 'bold', MUTED);
}

/** "Label ______" on one baseline, the line running to x + width. */
function fieldLine(c: Ctx, x: number, y: number, label: string, width: number) {
  text(c, x, y, label, 8.5, 'regular', MUTED);
  const start = x + textWidth(label, 'regular', 8.5 * c.k) + 6;
  c.page.line(start, y + 2, x + width, y + 2, { width: 0.75, gray: INK });
}

function signBox(c: Ctx, x: number, y: number, width: number, height: number) {
  c.page.rect(x, y, width, height, { width: 1, gray: 0.5, dash: 3 });
  text(c, x + 6, y + height - 5, 'Sign here', 7.5, 'regular', MUTED);
}

/** Custom counts for page 1: those used this period, with their all-time totals. */
function otherCounts(period: Counts, allTime: Counts) {
  const all = new Map(allTime.other.map((o) => [o.label.trim().toLowerCase(), o.value]));
  return period.other.map((o) => ({
    label: o.label,
    period: o.value,
    all: all.get(o.label.trim().toLowerCase()) ?? o.value,
  }));
}

/** Draw page 1 at scale k. Returns how far down the content above the footer reaches. */
function layout(c: Ctx, invoice: Invoice, pageCount: number, footerTop: number): number {
  const k = c.k;
  const half = (WIDTH - 24) / 2;
  const rightCol = LEFT + half + 24;
  let y = MARGIN;

  // Title, funding source, and the invoice's number, date and period.
  text(c, LEFT, y + 22 * k, 'INVOICE', 24, 'bold');
  const title = wrapText(`${invoice.source.code} · ${invoice.source.name}`, 'bold', 10.5 * k, 300);
  let left = y + 22 * k;
  for (const line of title) {
    left += 14 * k;
    text(c, LEFT, left, line, 10.5, 'bold');
  }
  const facts: [string, string, FontName][] = [
    ['Invoice #', invoice.number, 'bold'],
    ['Invoice date', longDate(invoice.invoice_date), 'regular'],
    ['Service period', dateRange(invoice.period_start, invoice.period_end), 'regular'],
  ];
  let right = y + 4 * k;
  for (const [label, value, font] of facts) {
    right += 13 * k;
    text(c, 372, right, label, 9.5, 'regular', MUTED);
    text(c, 446, right, value, 9.5, font);
  }
  y = Math.max(left, right) + 22 * k;

  // From and Bill to.
  caption(c, LEFT, y, 'From (contractor)', half);
  caption(c, rightCol, y, 'Bill to', half);
  const from = [
    invoice.chw.name,
    ...wrapLines(invoice.chw.mailing_address, 'regular', 9.5 * k, half, ADDRESS_LINES),
  ];
  from.forEach((line, i) => {
    text(c, LEFT, y + (14 + 12 * i) * k, fitText(line, 'regular', 9.5 * k, half), 9.5);
  });
  BILL_TO.forEach((line, i) => {
    text(c, rightCol, y + (14 + 12 * i) * k, line, 9.5);
  });
  y += (14 + 12 * Math.max(from.length, BILL_TO.length)) * k + 12 * k;

  // Lines by budget line and the amount due.
  const hoursX = 400;
  const rateX = 476;
  const nameWidth = 300;
  caption(c, LEFT, y, 'Budget line', nameWidth);
  text(c, hoursX, y, 'HOURS', 7.5, 'bold', MUTED, 'right');
  text(c, rateX, y, 'RATE', 7.5, 'bold', MUTED, 'right');
  text(c, RIGHT, y, 'AMOUNT', 7.5, 'bold', MUTED, 'right');
  y += 5 * k;
  c.page.line(LEFT, y, RIGHT, y, { width: 1.5, gray: INK });
  for (const line of invoice.lines) {
    const names = wrapText(line.budget_line_name, 'regular', 10 * k, nameWidth);
    const first = y + 14 * k;
    names.forEach((name, i) => {
      text(c, LEFT, first + 12 * i * k, name, 10);
    });
    text(c, hoursX, first, formatQuarters(line.quarters), 10, 'regular', INK, 'right');
    text(c, rateX, first, formatDollars(line.rate_cents), 10, 'regular', INK, 'right');
    text(c, RIGHT, first, formatDollars(line.amount_cents), 10, 'regular', INK, 'right');
    y = first + (12 * (names.length - 1) + 6) * k;
    c.page.line(LEFT, y, RIGHT, y, { width: 0.5, gray: RULE });
  }
  y += 15 * k;
  text(c, LEFT, y, 'Amount due', 10.5, 'bold');
  text(c, hoursX, y, formatQuarters(invoice.total_quarters), 10.5, 'bold', INK, 'right');
  text(c, RIGHT, y, formatDollars(invoice.total_cents), 12, 'bold', INK, 'right');
  y += 6 * k;
  c.page.line(LEFT, y, RIGHT, y, { width: 1.5, gray: INK });
  y += 22 * k;

  // Counts (left) and contract tracking (right).
  const top = y;
  caption(c, LEFT, y, 'Counts (numbers only, no names)', half);
  const periodX = LEFT + 168;
  const allX = LEFT + half;
  y += 13 * k;
  text(c, periodX, y, 'This period', 7.5, 'bold', MUTED, 'right');
  text(
    c,
    allX,
    y,
    fitText(`All time, ${invoice.source.code}`, 'bold', 7.5 * k, 70),
    7.5,
    'bold',
    MUTED,
    'right',
  );
  const rows = COUNT_FIELDS.map((f) => ({
    label: f.label,
    period: invoice.counts_period[f.key],
    all: invoice.counts_all_time[f.key],
  }));
  const others = otherCounts(invoice.counts_period, invoice.counts_all_time);
  rows.push(...others.slice(0, OTHER_COUNTS_SHOWN));
  for (const row of rows) {
    y += 12 * k;
    text(c, LEFT, y, fitText(row.label, 'regular', 9 * k, 108), 9);
    text(c, periodX, y, String(row.period), 9, 'bold', INK, 'right');
    text(c, allX, y, String(row.all), 9, 'regular', INK, 'right');
  }
  if (others.length > OTHER_COUNTS_SHOWN) {
    y += 12 * k;
    const more = others.length - OTHER_COUNTS_SHOWN;
    text(c, LEFT, y, `${String(more)} more in the entry log CSV`, 8, 'regular', MUTED);
  }
  const countsBottom = y;

  y = top;
  const nte = invoice.nte;
  if (nte.state !== 'none') caption(c, rightCol, y, 'Contract tracking', half);
  if (nte.state === 'not_entered') {
    y += 14 * k;
    text(c, rightCol, y, 'Not-to-exceed amount not entered', 9);
  } else if (nte.state === 'tracked') {
    const trackRows: [string, number][] = [
      ['Not-to-exceed amount', nte.nte_cents],
      ['Billed before this invoice', nte.billed_before_cents],
      ['This invoice', nte.this_invoice_cents],
      ['Remaining', nte.remaining_cents],
    ];
    y += 1 * k;
    trackRows.forEach(([label, cents], i) => {
      y += 12 * k;
      const font: FontName = i === 3 ? 'bold' : 'regular';
      text(c, rightCol, y, label, 9, font);
      text(c, RIGHT, y, formatDollars(cents), 9, font, INK, 'right');
    });
    if (nte.over) {
      const warning = wrapText(
        'OVER CONTRACT LIMIT: do not pay without an amendment',
        'bold',
        8.5 * k,
        half - 12,
      );
      const boxTop = y + 6 * k;
      const boxHeight = (warning.length * 11 + 6) * k;
      c.page.rect(rightCol, boxTop, half, boxHeight, { width: 1.2, gray: INK });
      warning.forEach((line, i) => {
        text(c, rightCol + 6, boxTop + (12 + 11 * i) * k, line, 8.5, 'bold');
      });
      y = boxTop + boxHeight;
    }
  }
  y = Math.max(countsBottom, y) + 18 * k;

  // Certification.
  const cert = wrapText(
    `Certification: ${invoice.source.certification_text}`,
    'regular',
    8.5 * k,
    WIDTH - 20,
  );
  const certHeight = (cert.length * 11 + 10) * k;
  c.page.rect(LEFT, y, WIDTH, certHeight, { fill: 0.95, stroke: false });
  cert.forEach((line, i) => {
    text(c, LEFT + 10, y + (14 + 11 * i) * k, line, 8.5);
  });
  y += certHeight + 18 * k;

  // Signatures.
  caption(c, LEFT, y, 'Contractor (CHW)', half);
  caption(c, rightCol, y, 'Services received (reviewer)', half);
  signBox(c, LEFT, y + 6 * k, half, 44 * k);
  fieldLine(c, LEFT, y + 70 * k, 'Date', half);
  fieldLine(c, rightCol, y + 20 * k, 'Printed name', half);
  fieldLine(c, rightCol, y + 38 * k, 'Title', half);
  signBox(c, rightCol, y + 44 * k, half, 34 * k);
  fieldLine(c, rightCol, y + 94 * k, 'Date', half);
  y += 108 * k;

  // Office use, beside the QR code in the footer row.
  const officeWidth = footerQrLeft(invoice) - LEFT - 16;
  const officeTop = Math.max(y, footerTop);
  const officeHeight = 76 * k;
  c.page.rect(LEFT, officeTop, officeWidth, officeHeight, { width: 1.2, gray: INK });
  caption(c, LEFT + 10, officeTop + 13 * k, 'For Regenerating Sonora office use', officeWidth - 20);
  const cell = (officeWidth - 30) / 2;
  const pairs: [string, string][] = [
    ['Reviewed by', 'Date'],
    ['Approved by', 'Date'],
    ['Payment date', 'Check or transaction #'],
  ];
  pairs.forEach(([a, b], i) => {
    const row = officeTop + (32 + 18 * i) * k;
    fieldLine(c, LEFT + 10, row, a, cell);
    fieldLine(c, LEFT + 20 + cell, row, b, cell);
  });

  drawFooter(c, invoice, pageCount);
  return y;
}

const QR_MAX = 104;
const QR_CELL_MAX = 1.6;

function qrLayout(invoice: Invoice) {
  const matrix = qrMatrix(qrPayloadV1(invoice));
  const cell = Math.min(QR_CELL_MAX, QR_MAX / matrix.length);
  return { matrix, cell, size: cell * matrix.length };
}

function footerQrLeft(invoice: Invoice): number {
  return RIGHT - qrLayout(invoice).size;
}

/** QR code bottom right, fingerprint and page number under it. Not scaled: it must scan. */
function drawFooter(c: Ctx, invoice: Invoice, pageCount: number) {
  const qr = qrLayout(invoice);
  const textTop = BOTTOM - 14;
  const qrTop = textTop - 8 - qr.size;
  c.page.modules(RIGHT - qr.size, qrTop, qr.cell, qr.matrix);
  c.page.text(RIGHT, textTop, `Fingerprint ${shortFingerprint(invoice.fingerprint)}`, {
    size: 8,
    gray: MUTED,
    align: 'right',
  });
  c.page.text(RIGHT, textTop + 10, `${invoice.number} · Page 1 of ${String(pageCount)}`, {
    size: 8,
    gray: MUTED,
    align: 'right',
  });
  c.page.text(
    LEFT,
    textTop + 10,
    'QR: invoice #, period, hours and amount by budget line, fingerprint',
    {
      size: 7,
      gray: MUTED,
    },
  );
}

/** Where the office box starts at scale k: the bottom of the page less the footer. */
function footerTopAt(k: number): number {
  return BOTTOM - 26 - 76 * k;
}

const SCALES = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6];

/**
 * Draw page 1 on `page`. Returns the scale used and the space left above the footer
 * (negative only if even the smallest scale overflowed).
 */
export function drawInvoicePage(
  page: PdfPage,
  invoice: Invoice,
  pageCount: number,
): { scale: number; spare: number } {
  // Content must stay above the office box and clear of the QR code's quiet zone.
  const qr = qrLayout(invoice);
  const qrTop = BOTTOM - 22 - qr.size - 4 * qr.cell;
  for (const k of SCALES) {
    const trial = new PdfPage(page.width, page.height);
    const bottom = layout({ page: trial, k }, invoice, pageCount, footerTopAt(k));
    const spare = Math.min(footerTopAt(k), qrTop) - bottom;
    if (spare >= 0 || k === SCALES[SCALES.length - 1]) {
      page.ops.push(...trial.ops);
      return { scale: k, spare };
    }
  }
  /* c8 ignore next */
  throw new Error('unreachable');
}
