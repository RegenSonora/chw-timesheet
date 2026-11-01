import { describe, expect, it } from 'vitest';
import { csvCell, csvFile, csvRow } from '../../src/files/csv/csv';
import { csvText } from './helpers';

describe('csvCell (SPEC §7 CSV rules)', () => {
  it('leaves plain text alone', () => {
    expect(csvCell('Client check in')).toBe('Client check in');
    expect(csvCell('')).toBe('');
    expect(csvCell('2026-10-30T09:12:04-07:00')).toBe('2026-10-30T09:12:04-07:00');
  });

  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('New CHWs: training, stipends, field hours')).toBe(
      '"New CHWs: training, stipends, field hours"',
    );
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it.each(['=', '+', '-', '@'])('guards a cell starting with %s', (c) => {
    expect(csvCell(`${c}SUM(A1)`)).toBe(`'${c}SUM(A1)`);
  });

  it('guards before quoting', () => {
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });

  it('only guards the first character', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('Food boxes=2; Library cards=1')).toBe('Food boxes=2; Library cards=1');
  });
});

describe('csvFile', () => {
  it('joins rows with CRLF, ends with CRLF and starts with a BOM', () => {
    const bytes = csvFile([['a', 'b'], [], ['c']]);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csvText(bytes)).toBe('a,b\r\n\r\nc\r\n');
  });

  it('writes UTF-8', () => {
    expect(csvText(csvFile([['Café', 'niño']]))).toBe('Café,niño\r\n');
  });

  it('csvRow joins cells with commas', () => {
    expect(csvRow(['1', 'a,b', '=x'])).toBe(`1,"a,b",'=x`);
  });
});
