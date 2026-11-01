import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const pub = join(import.meta.dirname, '..', '..', 'public');
const manifest = JSON.parse(readFileSync(join(pub, 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  short_name: string;
  id: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): string {
  const png = readFileSync(join(pub, path));
  return `${String(png.readUInt32BE(16))}x${String(png.readUInt32BE(20))}`;
}

describe('manifest (SPEC §2, §10; decision 0015)', () => {
  it('installs as "CHW Time Tracker", standalone, inside the app folder', () => {
    expect(manifest.name).toBe('CHW Time Tracker');
    expect(manifest).toMatchObject({
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'portrait',
    });
  });

  it('uses the gray background, not a brand color', () => {
    expect(manifest.background_color).toBe('#f4f5f7');
    expect(manifest.theme_color).toBe('#f4f5f7');
  });

  it('lists icons that exist at their stated sizes, including a maskable one', () => {
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(icon.src)).toBe(icon.sizes);
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('has the iPhone Home Screen icon at 180 px', () => {
    expect(pngSize('icons/apple-touch-icon.png')).toBe('180x180');
  });
});
