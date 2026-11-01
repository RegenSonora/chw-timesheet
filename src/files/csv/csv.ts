// CSV rules (SPEC §7): UTF-8 with byte-order mark, RFC 4180 quoting, CRLF line ends, and a
// leading apostrophe on any cell a spreadsheet would read as a formula.

const FORMULA_START = /^[=+\-@]/;
const NEEDS_QUOTES = /[",\r\n]/;

export function csvCell(value: string): string {
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

export function csvRow(cells: readonly string[]): string {
  return cells.map(csvCell).join(',');
}

/** Rows → file bytes. An empty row is a blank line. */
export function csvFile(rows: readonly (readonly string[])[]): Uint8Array<ArrayBuffer> {
  const text = rows.map((r) => `${csvRow(r)}\r\n`).join('');
  return new TextEncoder().encode(`\uFEFF${text}`);
}
