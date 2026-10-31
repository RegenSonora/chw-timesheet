// Writes placeholder icons into public/icons/. Run once; the output is committed. Real icons: M5.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './lib/png.mjs';

/** @type {[number, number, number]} */
const ACCENT = [0x1f, 0x5f, 0xc8];
/** @type {[number, number, number]} */
const LIGHT = [0xf4, 0xf5, 0xf7];

/**
 * Accent square with a light inner square; `inset` is the margin as a fraction of the size.
 * @param {number} size
 * @param {number} inset
 */
function icon(size, inset) {
  const lo = Math.round(size * inset);
  const hi = size - lo;
  return encodePng(size, size, (x, y) => (x >= lo && x < hi && y >= lo && y < hi ? LIGHT : ACCENT));
}

const dir = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'apple-touch-icon.png'), icon(180, 0.3));
writeFileSync(join(dir, 'icon-192.png'), icon(192, 0.3));
writeFileSync(join(dir, 'icon-512.png'), icon(512, 0.3));
// Maskable: keep the mark inside the 80% safe zone.
writeFileSync(join(dir, 'icon-maskable-512.png'), icon(512, 0.36));
console.log('Wrote public/icons/*.png');
