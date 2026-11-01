// Writes the app icons into public/icons/ (decision 0015): white "CHW" on the accent blue,
// no logo. Run after changing the design; the output is committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './lib/png.mjs';

/** @type {[number, number, number]} */
const ACCENT = [0x1f, 0x5f, 0xc8];
/** @type {[number, number, number]} */
const WHITE = [0xff, 0xff, 0xff];

/** Letter strokes, in units of the letter height (y runs down). */
const STROKE = 0.21;
const GAP = 0.16;
const C_WIDTH = 0.9;
const H_WIDTH = 0.8;
const W_WIDTH = 1.12;
const TEXT_WIDTH = C_WIDTH + GAP + H_WIDTH + GAP + W_WIDTH;

/**
 * Distance from (x, y) to the segment a–b.
 * @param {number} x @param {number} y
 * @param {[number, number]} a @param {[number, number]} b
 */
function toSegment(x, y, a, b) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/** @param {number} x @param {number} y */
function inC(x, y) {
  const [rx, ry] = [C_WIDTH / 2, 0.5];
  const [dx, dy] = [x - rx, y - ry];
  const outer = (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
  const inner = (dx / (rx - STROKE)) ** 2 + (dy / (ry - STROKE)) ** 2 < 1;
  // Open on the right, 45° either side of center.
  return outer && !inner && Math.abs(Math.atan2(dy, dx)) > Math.PI / 4;
}

/** @param {number} x @param {number} y */
function inH(x, y) {
  if (x < 0 || x > H_WIDTH) return false;
  return x <= STROKE || x >= H_WIDTH - STROKE || Math.abs(y - 0.5) <= STROKE / 2;
}

/** @type {[number, number][]} */
const W_POINTS = [
  [0.06, 0],
  [0.29, 1],
  [W_WIDTH / 2, 0.28],
  [W_WIDTH - 0.29, 1],
  [W_WIDTH - 0.06, 0],
];

/** @param {number} x @param {number} y */
function inW(x, y) {
  for (let i = 0; i < W_POINTS.length - 1; i++) {
    const a = W_POINTS[i];
    const b = W_POINTS[i + 1];
    if (a && b && toSegment(x, y, a, b) <= STROKE / 2) return true;
  }
  return false;
}

/** Whether a point of the text block (0..TEXT_WIDTH × 0..1) is inside a letter. */
function inText(/** @type {number} */ x, /** @type {number} */ y) {
  if (y < 0 || y > 1) return false;
  if (x < C_WIDTH) return inC(x, y);
  x -= C_WIDTH + GAP;
  if (x < H_WIDTH + GAP / 2) return inH(x, y);
  x -= H_WIDTH + GAP;
  return inW(x, y);
}

/**
 * A full-bleed accent square (phones round the corners) with the letters centered.
 * @param {number} size pixels
 * @param {number} textWidth letters' width as a fraction of the size
 */
function icon(size, textWidth) {
  const scale = (size * textWidth) / TEXT_WIDTH; // pixels per letter-height unit
  const left = (size - size * textWidth) / 2;
  const top = (size - scale) / 2;
  const SAMPLES = 4;
  return encodePng(size, size, (px, py) => {
    let hits = 0;
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const x = (px + (sx + 0.5) / SAMPLES - left) / scale;
        const y = (py + (sy + 0.5) / SAMPLES - top) / scale;
        if (inText(x, y)) hits++;
      }
    }
    const cover = hits / (SAMPLES * SAMPLES);
    return /** @type {[number, number, number]} */ (
      ACCENT.map((c, i) => Math.round(c + ((WHITE[i] ?? 0) - c) * cover))
    );
  });
}

const dir = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'apple-touch-icon.png'), icon(180, 0.68));
writeFileSync(join(dir, 'icon-192.png'), icon(192, 0.68));
writeFileSync(join(dir, 'icon-512.png'), icon(512, 0.68));
// Maskable: the letters stay inside the 80% safe-zone circle.
writeFileSync(join(dir, 'icon-maskable-512.png'), icon(512, 0.56));
console.log('Wrote public/icons/*.png');
