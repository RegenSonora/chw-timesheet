// PDF timesheet pages (SPEC §7, wireframe PdfTimesheet): landscape, the next 7 dates worked per
// page. When the rows don't fit, the grid's text shrinks to 7 pt, then notes are cut (decision 0013).
import { shortFingerprint } from '../../core/fingerprint';
import { formatDollars, formatQuarters } from '../../core/money';
import type { TimesheetPage } from '../../core/timesheet';
import type { Invoice } from '../../core/types';
import { dateRange, monthDay, weekday } from '../text';
import { fitText, textWidth, wrapLines, wrapText, type FontName } from './fonts';
import { LETTER_LANDSCAPE, PdfPage, type Gray } from './writer';

const MARGIN = 36;
const LEFT = MARGIN;
const RIGHT = LETTER_LANDSCAPE.width - MARGIN;
const WIDTH = RIGHT - LEFT;
const BOTTOM = LETTER_LANDSCAPE.height - 30;
const INK: Gray = 0.1;
const MUTED: Gray = 0.3;
const RULE: Gray = 0.75;
const PAD = 3;

/** Grid sizes tried in order; 7 pt is the floor before notes are cut (decision 0013). */
const SIZES = [9, 8.5, 8, 7.5, 7];
const FLOOR = 7;
/** Below the floor, only when the rows alone don't fit: hours are never cut. */
const LAST_RESORT = [6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3];

interface Column {
  x: number;
  width: number;
  align: 'left' | 'right';
}

function columns(dateCount: number) {
  const task: Column = { x: LEFT, width: 96, align: 'left' };
  const competency: Column = { x: task.x + task.width, width: 104, align: 'left' };
  const line: Column = { x: competency.x + competency.width, width: 112, align: 'left' };
  const dates: Column[] = Array.from({ length: dateCount }, (_, i) => ({
    x: line.x + line.width + 38 * i,
    width: 38,
    align: 'right',
  }));
  const total: Column = { x: line.x + line.width + 38 * dateCount, width: 40, align: 'right' };
  const notes: Column = {
    x: total.x + total.width + 6,
    width: RIGHT - total.x - total.width - 6,
    align: 'left',
  };
  return { task, competency, line, dates, total, notes };
}

interface GridRow {
  /** Lines per text column, in column order: task, competency, budget line, notes. */
  task: string[];
  competency: string[];
  line: string[];
  notes: string[];
  height: number;
}

function gridRows(page: TimesheetPage, size: number, notesLines: number): GridRow[] {
  const cols = columns(page.dates.length);
  const leading = size * 1.25;
  const wrap = (s: string, col: Column) => wrapText(s, 'regular', size, col.width - PAD * 2);
  return page.rows.map((row) => {
    const task = wrap(row.task_name, cols.task);
    const competency = wrap(row.core_competency ?? '', cols.competency);
    const line = wrap(row.budget_line_name, cols.line);
    const notes = wrapLines(row.notes, 'regular', size, cols.notes.width - PAD * 2, notesLines);
    const lines = Math.max(1, task.length, competency.length, line.length, notes.length);
    return { task, competency, line, notes, height: lines * leading + vpad(size) * 2 + 2 };
  });
}

/** Space above and below a row's text; shrinks with the text so many rows can still fit. */
const vpad = (size: number) => size / 3;

const HEADER_HEIGHT = 26;

function gridHeight(rows: GridRow[], size: number): number {
  const totalRow = size * 1.25 + vpad(size) * 2 + 4;
  return HEADER_HEIGHT + rows.reduce((sum, r) => sum + r.height, 0) + totalRow;
}

/** The grid's text size and notes limit that fit the space; see decision 0013. */
function fitGrid(
  page: TimesheetPage,
  space: number,
): { size: number; rows: GridRow[]; cut: boolean } {
  for (const size of SIZES) {
    const rows = gridRows(page, size, Number.MAX_SAFE_INTEGER);
    if (gridHeight(rows, size) <= space) return { size, rows, cut: false };
  }
  const fullest = Math.max(
    1,
    ...gridRows(page, FLOOR, Number.MAX_SAFE_INTEGER).map((r) => r.notes.length),
  );
  for (let lines = fullest - 1; lines >= 1; lines--) {
    const rows = gridRows(page, FLOOR, lines);
    if (gridHeight(rows, FLOOR) <= space) return { size: FLOOR, rows, cut: true };
  }
  for (const size of LAST_RESORT) {
    const rows = gridRows(page, size, 1);
    if (gridHeight(rows, size) <= space) return { size, rows, cut: true };
  }
  const size = LAST_RESORT[LAST_RESORT.length - 1] ?? FLOOR;
  return { size, rows: gridRows(page, size, 1), cut: true };
}

export interface TimesheetPageResult {
  size: number;
  /** True when some notes were cut short. */
  cut: boolean;
  /** Space left under the grid; negative only if even the last resort overflowed. */
  spare: number;
}

export function drawTimesheetPage(
  pdf: PdfPage,
  invoice: Invoice,
  page: TimesheetPage,
  next: TimesheetPage | undefined,
): TimesheetPageResult {
  const text = (
    x: number,
    y: number,
    s: string,
    size: number,
    font: FontName = 'regular',
    gray: Gray = INK,
    align: 'left' | 'right' = 'left',
  ) => {
    pdf.text(x, y, s, { size, font, gray, align });
  };

  // Header.
  let y = MARGIN + 16;
  text(LEFT, y, `Timesheet · ${invoice.source.code}`, 17, 'bold');
  text(RIGHT, y - 4, invoice.chw.name, 10, 'regular', INK, 'right');
  y += 17;
  const datesWorked =
    page.first_date_index === page.last_date_index
      ? String(page.first_date_index)
      : `${String(page.first_date_index)}–${String(page.last_date_index)}`;
  const first = page.dates[0] ?? '';
  const last = page.dates[page.dates.length - 1] ?? '';
  text(
    LEFT,
    y,
    `Dates worked ${datesWorked} of ${String(page.date_count)} · ${dateRange(first, last)}`,
    10.5,
  );
  text(
    RIGHT,
    y - 4,
    `Invoice ${invoice.number} · Rate ${formatDollars(invoice.rate_cents)}/h`,
    10,
    'regular',
    INK,
    'right',
  );
  y += 16;

  // What goes under the grid, measured first so the grid knows its space.
  const subtotalHeight = 16 + 12 * (page.subtotals.length + 1);
  const continuedHeight = next ? 16 : 0;
  const footerHeight = 34;
  const space = BOTTOM - footerHeight - continuedHeight - subtotalHeight - 14 - y;
  const fit = fitGrid(page, space);
  const { size, rows } = fit;
  const leading = size * 1.25;
  const cols = columns(page.dates.length);

  // Grid header.
  const cell = (
    col: Column,
    row: number,
    s: string,
    font: FontName = 'regular',
    gray: Gray = INK,
    sz = size,
  ) => {
    if (col.align === 'right') text(col.x + col.width - PAD, row, s, sz, font, gray, 'right');
    else text(col.x + PAD, row, s, sz, font, gray);
  };
  const headerBase = y + HEADER_HEIGHT - 6;
  const head = 7.5;
  cell(cols.task, headerBase, 'TASK', 'bold', MUTED, head);
  cell(cols.competency, headerBase, 'CORE COMPETENCY', 'bold', MUTED, head);
  cell(cols.line, headerBase, 'BUDGET LINE', 'bold', MUTED, head);
  page.dates.forEach((date, i) => {
    const col = cols.dates[i];
    if (!col) return;
    cell(col, headerBase - 9, weekday(date).toUpperCase(), 'bold', MUTED, head);
    cell(col, headerBase, monthDay(date), 'bold', MUTED, head);
  });
  cell(cols.total, headerBase, 'TOTAL', 'bold', MUTED, head);
  cell(cols.notes, headerBase, 'NOTES', 'bold', MUTED, head);
  y += HEADER_HEIGHT;
  pdf.line(LEFT, y, RIGHT, y, { width: 1.5, gray: INK });

  // Rows.
  page.rows.forEach((row, r) => {
    const g = rows[r];
    if (!g) return;
    const base = y + vpad(size) + size;
    const many = (col: Column, lines: string[]) => {
      lines.forEach((l, i) => {
        cell(col, base + leading * i, l);
      });
    };
    many(cols.task, g.task);
    many(cols.competency, g.competency);
    many(cols.line, g.line);
    row.cells.forEach((q, i) => {
      const col = cols.dates[i];
      if (col && q !== null) cell(col, base, formatQuarters(q));
    });
    cell(cols.total, base, formatQuarters(row.total), 'bold');
    many(cols.notes, g.notes);
    y += g.height;
    pdf.line(LEFT, y, RIGHT, y, { width: 0.5, gray: RULE });
  });

  // Total hours per date.
  pdf.line(LEFT, y, RIGHT, y, { width: 1.5, gray: INK });
  const totalBase = y + vpad(size) + 2 + size;
  cell(cols.task, totalBase, 'Total hours', 'bold');
  page.date_totals.forEach((q, i) => {
    const col = cols.dates[i];
    if (col) cell(col, totalBase, formatQuarters(q), 'bold');
  });
  cell(cols.total, totalBase, formatQuarters(page.page_total), 'bold');
  y += size * 1.25 + vpad(size) * 2 + 4;
  const spare = BOTTOM - footerHeight - continuedHeight - subtotalHeight - 14 - y;

  // Subtotals by budget line.
  y += 22;
  text(LEFT, y, 'SUBTOTAL BY BUDGET LINE (THIS PAGE)', 7.5, 'bold', MUTED);
  const hoursX = LEFT + 330;
  for (const sub of page.subtotals) {
    y += 12;
    text(LEFT, y, fitText(sub.budget_line_name, 'regular', 9, 270), 9);
    text(hoursX, y, `${formatQuarters(sub.quarters)} h`, 9, 'regular', INK, 'right');
  }
  y += 12;
  text(LEFT, y, 'Page total', 9, 'bold');
  text(hoursX, y, `${formatQuarters(page.page_total)} h`, 9, 'bold', INK, 'right');

  if (next) {
    y += 18;
    const dates = next.dates.map((d) => `${weekday(d)} ${monthDay(d)}`).join(', ');
    text(
      LEFT,
      y,
      fitText(`Continued on page ${String(next.page_number)}: ${dates}.`, 'regular', 9, WIDTH),
      9,
      'regular',
      MUTED,
    );
  }

  // Footer: initials line, fingerprint, invoice # and page number.
  const label = 'CHW initials';
  text(LEFT, BOTTOM, label, 9, 'regular', MUTED);
  const lineStart = LEFT + textWidth(label, 'regular', 9) + 6;
  pdf.line(lineStart, BOTTOM + 2, lineStart + 110, BOTTOM + 2, { width: 0.75, gray: INK });
  text(
    RIGHT,
    BOTTOM - 10,
    `Fingerprint ${shortFingerprint(invoice.fingerprint)}`,
    8,
    'regular',
    MUTED,
    'right',
  );
  text(
    RIGHT,
    BOTTOM,
    `${invoice.number} · Page ${String(page.page_number)} of ${String(page.page_count)}`,
    8,
    'regular',
    MUTED,
    'right',
  );

  return { size, cut: fit.cut, spare };
}
