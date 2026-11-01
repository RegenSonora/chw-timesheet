// The two built-in PDF fonts the files use, Helvetica and Helvetica-Bold, in WinAnsiEncoding.
// Widths are the standard Adobe AFM metrics (1/1000 em) for codes 32–255; codes WinAnsi leaves
// undefined have width 0 and are never written.

export type FontName = 'regular' | 'bold';

// prettier-ignore
const HELVETICA = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
// prettier-ignore
const HELVETICA_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

const WIDTHS: Record<FontName, readonly number[]> = { regular: HELVETICA, bold: HELVETICA_BOLD };

/** WinAnsi codes 128–159 that are not the same number in Unicode. */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const QUESTION = 0x3f;
const SPACE = 0x20;

/** Text → WinAnsi codes. Line breaks and tabs become spaces; anything the font can't show becomes "?". */
export function toWinAnsi(text: string): number[] {
  const codes: number[] = [];
  for (const ch of text) {
    const u = ch.codePointAt(0) ?? QUESTION;
    if (u === 0x09 || u === 0x0a || u === 0x0d) codes.push(SPACE);
    else if (u >= 0x20 && u <= 0x7e) codes.push(u);
    else if (u === 0xa0) codes.push(SPACE);
    else if (u >= 0xa1 && u <= 0xff && u !== 0xad) codes.push(u);
    else codes.push(WIN_ANSI_HIGH[u] ?? QUESTION);
  }
  return codes;
}

/** Width of text in points. */
export function textWidth(text: string, font: FontName, size: number): number {
  const widths = WIDTHS[font];
  let units = 0;
  for (const code of toWinAnsi(text)) units += widths[code - 32] ?? 0;
  return (units * size) / 1000;
}

const ELLIPSIS = '…';

/** Cut text to fit maxWidth, ending in "…" when anything was cut. */
export function fitText(text: string, font: FontName, size: number, maxWidth: number): string {
  if (textWidth(text, font, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && textWidth(chars.join('') + ELLIPSIS, font, size) > maxWidth) chars.pop();
  return chars.join('').trimEnd() + ELLIPSIS;
}

/** Split a long word into pieces no wider than maxWidth. */
function breakWord(word: string, font: FontName, size: number, maxWidth: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const ch of word) {
    if (piece && textWidth(piece + ch, font, size) > maxWidth) {
      pieces.push(piece);
      piece = ch;
    } else piece += ch;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/**
 * Wrap text into lines no wider than maxWidth, breaking at spaces (and inside words longer
 * than a line). Line breaks in the text are kept. Empty text gives no lines.
 */
export function wrapText(text: string, font: FontName, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = '';
    for (const word of paragraph.split(/[ \t]+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, font, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      const pieces = breakWord(word, font, size, maxWidth);
      line = pieces.pop() ?? '';
      lines.push(...pieces);
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Wrap, keeping at most maxLines lines; the last kept line ends in "…" when text was left out. */
export function wrapLines(
  text: string,
  font: FontName,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapText(text, font, size, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, Math.max(1, maxLines));
  const last = kept.length - 1;
  kept[last] = fitText(`${kept[last] ?? ''}${ELLIPSIS}`, font, size, maxWidth);
  return kept;
}
