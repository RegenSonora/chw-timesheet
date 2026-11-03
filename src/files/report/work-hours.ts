// The Work Hours Report files (decision 0026): a PDF laid out like the ADHS CHW hours attestation
// form, its first page as shapes for the picture, and a CSV with the same rows. Pure like the
// invoice files: the same report gives the same bytes.
import { formatQuarters } from '../../core/money';
import type { ReportForm, WorkHoursReport } from '../../core/work-hours';
import { csvFile } from '../csv/csv';
import { BILL_TO } from '../pdf/invoice-page';
import { fitText, wrapText, type FontName } from '../pdf/fonts';
import { LETTER, PdfDocument, PdfPage, type Gray, type Shape } from '../pdf/writer';

/** Who and what the report is for. */
export interface ReportDetails {
  chw_name: string;
  source_code: string;
  /** The source's `report_funding_line`, or its name. */
  funding_line: string;
  /** ISO 8601 with offset: when the report was made. */
  made_at: string;
}

export interface ReportFile {
  name: string;
  type: 'application/pdf' | 'text/csv' | 'image/png';
  bytes: Uint8Array<ArrayBuffer>;
}

/** The organization block on the form (SPEC §7's Bill to). */
export const ORGANIZATION = BILL_TO.join(', ');

/** "Carmen Cruz Lopez" → first "Carmen", last "Cruz Lopez". Check against the legal name. */
export function splitName(name: string): { first: string; last: string } {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { first, last: rest.join(' ') };
}

/** 2026-10-20 → "10/20/2026", as written on the ADHS form. */
export function usDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`Not a YYYY-MM-DD date: ${date}`);
  return `${m[2] ?? ''}/${m[3] ?? ''}/${m[1] ?? ''}`;
}

export const datesText = (dates: readonly string[]) => dates.map(usDate).join(', ');

export const reportBaseName = (details: ReportDetails, report: WorkHoursReport) =>
  `${details.source_code}_Work_Hours_Report_${report.made_on}`;

function periodText(report: WorkHoursReport): string {
  return `${usDate(report.window_start)} – ${usDate(report.made_on)}`;
}

function invoicesText(report: WorkHoursReport): string {
  const n = report.invoice_numbers;
  if (n.length === 0) return 'no invoices yet';
  if (n.length === 1) return `invoice ${n[0] ?? ''}`;
  return `invoices ${n[0] ?? ''} to ${n[n.length - 1] ?? ''}`;
}

/** The rows the form gets, plus Other when the source had competencies the form doesn't list. */
function tableRows(report: WorkHoursReport) {
  return report.other.quarters > 0 ? [...report.rows, report.other] : report.rows;
}

// --- CSV ------------------------------------------------------------------------------------

export function workHoursCsv(
  form: ReportForm,
  report: WorkHoursReport,
  details: ReportDetails,
): Uint8Array<ArrayBuffer> {
  const name = splitName(details.chw_name);
  return csvFile([
    ['Report', 'CHW Work Hours Report'],
    ['For', `${form.title} (${form.issuer}, revised ${form.revised})`],
    ['Legal first name', name.first],
    ['Legal last name', name.last],
    ['Organization', ORGANIZATION],
    ['Funding source', details.funding_line],
    ['Period', usDate(report.window_start), usDate(report.made_on)],
    ['Hours worked', formatQuarters(report.total_quarters)],
    ['From', invoicesText(report)],
    [],
    ['Core Competency', 'Number of Hours', 'Dates Completed'],
    ...tableRows(report).map((r) => [r.name, formatQuarters(r.quarters), datesText(r.dates)]),
    ['Total', formatQuarters(report.total_quarters), ''],
  ]);
}

// --- PDF ------------------------------------------------------------------------------------

const MARGIN = 48;
const LEFT = MARGIN;
const RIGHT = LETTER.width - MARGIN;
const WIDTH = RIGHT - LEFT;
const BOTTOM = LETTER.height - 48;
const INK: Gray = 0.1;
const MUTED: Gray = 0.3;
/** The form's dark red bands, in gray. */
const BAND: Gray = 0.35;
const NAME_W = 170;
const HOURS_W = 70;
const DATES_W = WIDTH - NAME_W - HOURS_W;
const PAD = 6;
const SIZE = 9.5;
const LINE = 12;

const CENTRE = LETTER.width / 2;

function band(page: PdfPage, y: number, label: string): number {
  page.rect(LEFT, y, WIDTH, 18, { fill: BAND, stroke: false });
  page.text(CENTRE, y + 12.5, label, { size: 9.5, font: 'bold', gray: 1, align: 'center' });
  return y + 18;
}

/** Boxes in a row with a small label and a value, like the form's fields. */
function fields(page: PdfPage, y: number, cells: { label: string; value: string; w: number }[]) {
  const h = 30;
  let x = LEFT;
  for (const cell of cells) {
    page.rect(x, y, cell.w, h, { width: 0.75, gray: INK });
    page.text(x + 4, y + 9, cell.label, { size: 7, gray: MUTED });
    page.text(x + 4, y + 23, fitText(cell.value, 'regular', 10, cell.w - 8), {
      size: 10,
      gray: INK,
    });
    x += cell.w;
  }
  return y + h;
}

function centred(page: PdfPage, y: number, text: string, size: number, font: FontName) {
  const lines = wrapText(text, font, size, WIDTH);
  lines.forEach((line, i) => {
    page.text(CENTRE, y + i * (size + 3), line, { size, font, gray: INK, align: 'center' });
  });
  return y + lines.length * (size + 3);
}

function tableHeader(page: PdfPage, y: number): number {
  const h = 26;
  page.rect(LEFT, y, WIDTH, h, { width: 0.75, gray: INK });
  page.line(LEFT + NAME_W, y, LEFT + NAME_W, y + h, { width: 0.75, gray: INK });
  page.line(LEFT + NAME_W + HOURS_W, y, LEFT + NAME_W + HOURS_W, y + h, {
    width: 0.75,
    gray: INK,
  });
  page.text(LEFT + PAD, y + 16, 'Core Competency', { size: SIZE, font: 'bold', gray: INK });
  page.text(LEFT + NAME_W + PAD, y + 11, 'Number of', { size: SIZE, font: 'bold', gray: INK });
  page.text(LEFT + NAME_W + PAD, y + 22, 'Hours', { size: SIZE, font: 'bold', gray: INK });
  page.text(LEFT + NAME_W + HOURS_W + PAD, y + 16, 'Dates Completed', {
    size: SIZE,
    font: 'bold',
    gray: INK,
  });
  page.line(LEFT, y + h, RIGHT, y + h, { width: 2, gray: 0 });
  return y + h;
}

interface Row {
  label: string;
  name: string[];
  hours: string;
  dates: string[];
  bold: boolean;
}

function rowHeight(row: Row): number {
  return Math.max(row.name.length, row.dates.length, 1) * LINE + 2 * PAD + 2;
}

function drawRow(page: PdfPage, y: number, row: Row): number {
  const h = rowHeight(row);
  page.rect(LEFT, y, WIDTH, h, { width: 0.75, gray: INK });
  page.line(LEFT + NAME_W, y, LEFT + NAME_W, y + h, { width: 0.75, gray: INK });
  page.line(LEFT + NAME_W + HOURS_W, y, LEFT + NAME_W + HOURS_W, y + h, {
    width: 0.75,
    gray: INK,
  });
  const font: FontName = row.bold ? 'bold' : 'regular';
  const first = y + PAD + 9;
  row.name.forEach((line, i) => {
    page.text(LEFT + PAD, first + i * LINE, line, { size: SIZE, font, gray: INK });
  });
  page.text(LEFT + NAME_W + HOURS_W - PAD, first, row.hours, {
    size: SIZE,
    font,
    gray: INK,
    align: 'right',
  });
  row.dates.forEach((line, i) => {
    page.text(LEFT + NAME_W + HOURS_W + PAD, first + i * LINE, line, { size: SIZE, gray: INK });
  });
  return y + h;
}

function footer(page: PdfPage, made: string, n: number, count: number) {
  page.text(
    LEFT,
    BOTTOM + 20,
    `Made by CHW Gila River Contractors on ${usDate(made)} from invoices on this phone.`,
    { size: 7.5, gray: MUTED },
  );
  page.text(RIGHT, BOTTOM + 20, `Page ${String(n)} of ${String(count)}`, {
    size: 7.5,
    gray: MUTED,
    align: 'right',
  });
}

/** Every page of the report, laid out top to bottom; the table continues on new pages. */
export function workHoursPages(
  form: ReportForm,
  report: WorkHoursReport,
  details: ReportDetails,
): PdfPage[] {
  const pages: PdfPage[] = [];
  const newPage = () => {
    const page = new PdfPage(LETTER.width, LETTER.height);
    pages.push(page);
    return page;
  };
  let page = newPage();
  let y = MARGIN + 10;
  y = centred(page, y, 'CHW WORK HOURS REPORT', 13, 'bold') + 2;
  y = centred(
    page,
    y,
    `For the ${form.issuer} ${form.title} (revised ${form.revised})`,
    9,
    'regular',
  );
  y += 8;

  const name = splitName(details.chw_name);
  y = band(page, y, 'APPLICANT INFORMATION');
  y = fields(page, y, [
    { label: 'Legal First Name', value: name.first, w: WIDTH / 2 },
    { label: 'Legal Last Name', value: name.last, w: WIDTH / 2 },
  ]);
  y = band(page, y + 8, 'ORGANIZATION INFORMATION');
  y = fields(page, y, [{ label: 'Organization', value: ORGANIZATION, w: WIDTH }]);
  const funding = wrapText(details.funding_line, 'regular', 9.5, WIDTH - 8);
  const fh = 14 + funding.length * 12;
  page.rect(LEFT, y, WIDTH, fh, { width: 0.75, gray: INK });
  page.text(LEFT + 4, y + 9, 'Funding source', { size: 7, gray: MUTED });
  funding.forEach((line, i) => {
    page.text(LEFT + 4, y + 21 + i * 12, line, { size: 9.5, gray: INK });
  });
  y += fh + 14;

  const sentence = wrapText(
    `Hours worked as a community health worker during the past ${String(form.window_years)} years or less: ` +
      `${formatQuarters(report.total_quarters)} (${periodText(report)}, from ${invoicesText(report)}).`,
    'regular',
    10,
    WIDTH,
  );
  sentence.forEach((line, i) => {
    page.text(LEFT, y + i * 13, line, { size: 10, gray: INK });
  });
  y += sentence.length * 13 + 8;

  const rows: Row[] = [
    ...tableRows(report).map((r) => ({
      label: r.name,
      name: wrapText(r.name, 'regular', SIZE, NAME_W - 2 * PAD),
      hours: formatQuarters(r.quarters),
      dates: wrapText(datesText(r.dates), 'regular', SIZE, DATES_W - 2 * PAD),
      bold: false,
    })),
    {
      label: 'Total',
      name: ['Total'],
      hours: formatQuarters(report.total_quarters),
      dates: [],
      bold: true,
    },
  ];
  y = tableHeader(page, y);
  for (const row of rows) {
    // A row with more dates than the page holds continues on the next page; no date is dropped.
    let rest = row;
    for (;;) {
      if (y + rowHeight(rest) <= BOTTOM) {
        y = drawRow(page, y, rest);
        break;
      }
      const fit = Math.floor((BOTTOM - y - 2 * PAD - 2) / LINE);
      if (fit >= Math.max(rest.name.length, 1) && rest.dates.length > fit) {
        drawRow(page, y, { ...rest, dates: rest.dates.slice(0, fit) });
        rest = {
          ...rest,
          name: wrapText(`${rest.label} (continued)`, 'regular', SIZE, NAME_W - 2 * PAD),
          hours: '',
          dates: rest.dates.slice(fit),
        };
      }
      page = newPage();
      y = tableHeader(page, MARGIN);
    }
  }
  y += 10;
  const note = wrapText(
    'The authorized representative of the organization fills in and signs the ADHS form; this report is the supporting detail.',
    'regular',
    8,
    WIDTH,
  );
  if (y + note.length * 10 > BOTTOM) {
    page = newPage();
    y = MARGIN;
  }
  note.forEach((line, i) => {
    page.text(LEFT, y + 8 + i * 10, line, { size: 8, gray: MUTED });
  });

  pages.forEach((p, i) => {
    footer(p, report.made_on, i + 1, pages.length);
  });
  return pages;
}

export function workHoursPdf(
  form: ReportForm,
  report: WorkHoursReport,
  details: ReportDetails,
): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument();
  doc.pages.push(...workHoursPages(form, report, details));
  return doc.bytes({
    title: 'CHW Work Hours Report',
    author: details.chw_name,
    created: details.made_at,
  });
}

/** Page 1 as shapes, for the picture (decision 0018). */
export function workHoursPageShapes(
  form: ReportForm,
  report: WorkHoursReport,
  details: ReportDetails,
): { width: number; height: number; shapes: Shape[] } {
  const [page] = workHoursPages(form, report, details);
  return { width: LETTER.width, height: LETTER.height, shapes: page?.shapes ?? [] };
}

/** PDF and CSV; the UI adds the picture, which needs a canvas. */
export function buildWorkHoursFiles(
  form: ReportForm,
  report: WorkHoursReport,
  details: ReportDetails,
): ReportFile[] {
  const base = reportBaseName(details, report);
  return [
    { name: `${base}.pdf`, type: 'application/pdf', bytes: workHoursPdf(form, report, details) },
    { name: `${base}.csv`, type: 'text/csv', bytes: workHoursCsv(form, report, details) },
  ];
}
