// Writes the app icons into public/icons/ (decision 0021): a desert night scene from the
// Regenerating Sonora sketch. Starry sky, the moon rising over the mesa, the sun setting behind
// the mountain in front. Run after changing the design; the output is committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './lib/png.mjs';

/** @typedef {[number, number]} Point */
/** @typedef {[number, number, number]} Rgb */

/** @param {string} hex @returns {Rgb} */
const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const SKY = rgb('#1b2150');
const CREAM = rgb('#fbf3de');
const MESA = rgb('#7a3b26');
const SLOPE = rgb('#2e8b6a');
const SAND = rgb('#f2dc9b');
const WATER = rgb('#5ec4c8');
const SUN = rgb('#f28c28');
const MOUNTAIN = rgb('#5a4fa3');
const SHADE = rgb('#3e3680');

/**
 * A closed outline from a path of absolute M, L and Q commands, curves flattened to lines.
 * @param {string} d
 * @returns {Point[]}
 */
function outline(d) {
  const tokens = d.match(/[MLQZ]|-?[\d.]+/g) ?? [];
  /** @type {Point[]} */
  const points = [];
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'L') points.push([num(), num()]);
    else if (cmd === 'Q') {
      const p0 = /** @type {Point} */ (points[points.length - 1]);
      /** @type {Point} */
      const q = [num(), num()];
      /** @type {Point} */
      const p = [num(), num()];
      for (let s = 1; s <= 16; s++) {
        const t = s / 16;
        const u = 1 - t;
        points.push([
          u * u * p0[0] + 2 * u * t * q[0] + t * t * p[0],
          u * u * p0[1] + 2 * u * t * q[1] + t * t * p[1],
        ]);
      }
    }
  }
  return points;
}

/** @param {number} x @param {number} y @param {Point[]} polygon */
function inside(x, y, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = /** @type {Point} */ (polygon[i]);
    const [xj, yj] = /** @type {Point} */ (polygon[j]);
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The scene on a 100 × 100 square, y running down; later layers cover earlier ones.
const MESA_SHAPE = outline('M0 30 Q20 22 45 22 L85 21 L100 26 L100 36 Q50 38 0 42 Z');
const SLOPE_SHAPE = outline('M0 42 Q50 36 100 34 L100 58 Q75 52 58 56 Q40 48 0 50 Z');
const WATER_SHAPE = outline('M0 50 Q30 46 46 58 Q56 66 48 76 Q30 82 0 80 Z');
const MOUNTAIN_SHAPE = outline('M30 100 L50 66 L58 72 L66 60 L86 86 L100 100 Z');
const SHADE_SHAPE = outline('M58 72 L66 60 L74 100 L62 100 Z');
/** @type {[number, number, number][]} x, y, radius */
const STARS = [
  [12, 8, 0.9],
  [48, 6, 0.7],
  [62, 13, 1],
  [78, 7, 0.8],
  [90, 15, 0.9],
  [6, 20, 0.7],
  [40, 15, 0.6],
  [70, 4, 0.6],
  [54, 19, 0.6],
];

/** The color at a point of the scene. @param {number} x @param {number} y @returns {Rgb} */
function colorAt(x, y) {
  if (inside(x, y, SHADE_SHAPE)) return SHADE;
  if (inside(x, y, MOUNTAIN_SHAPE)) return MOUNTAIN;
  if (Math.hypot(x - 44, y - 72) <= 9) return SUN;
  if (inside(x, y, WATER_SHAPE)) return WATER;
  if (y >= 50) return SAND;
  if (inside(x, y, SLOPE_SHAPE)) return SLOPE;
  if (inside(x, y, MESA_SHAPE)) return MESA;
  if (Math.hypot(x - 24, y - 15) <= 7) return CREAM;
  for (const [sx, sy, r] of STARS) if (Math.hypot(x - sx, y - sy) <= r) return CREAM;
  return SKY;
}

/**
 * The scene filling the square (phones round the corners).
 * @param {number} size pixels
 * @param {number} scale the scene's size as a fraction of the icon; the edges extend outward
 */
function icon(size, scale) {
  const SAMPLES = 4;
  // Just inside the edges, so shapes that touch the border keep going outward.
  const clamp = (/** @type {number} */ v) => Math.min(99.99, Math.max(0.01, v));
  return encodePng(size, size, (px, py) => {
    /** @type {Rgb} */
    const sum = [0, 0, 0];
    for (let sy = 0; sy < SAMPLES; sy++) {
      for (let sx = 0; sx < SAMPLES; sx++) {
        const x = 50 + (((px + (sx + 0.5) / SAMPLES) / size) * 100 - 50) / scale;
        const y = 50 + (((py + (sy + 0.5) / SAMPLES) / size) * 100 - 50) / scale;
        const c = colorAt(clamp(x), clamp(y));
        for (let i = 0; i < 3; i++) sum[i] = (sum[i] ?? 0) + (c[i] ?? 0);
      }
    }
    return /** @type {Rgb} */ (sum.map((v) => Math.round(v / (SAMPLES * SAMPLES))));
  });
}

const dir = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'apple-touch-icon.png'), icon(180, 1));
writeFileSync(join(dir, 'icon-192.png'), icon(192, 1));
writeFileSync(join(dir, 'icon-512.png'), icon(512, 1));
// Maskable: the scene at 75% so the moon and sun stay inside the 80% safe-zone circle.
writeFileSync(join(dir, 'icon-maskable-512.png'), icon(512, 0.75));
console.log('Wrote public/icons/*.png');
