import { describe, expect, it } from 'vitest';
import { cacheName, isOldCache, route, shellRequests } from '../../src/sw-shell';

const SCOPE = 'https://regensonora.github.io/chw-timesheet/';
const SHELL = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png'];

const get = (url: string, mode = 'no-cors') => ({ method: 'GET', url, mode });

describe('offline cache (SPEC §2)', () => {
  it('names one cache per version', () => {
    expect(cacheName('0.9.0+a1b2c3d')).toBe('chw-0.9.0+a1b2c3d');
  });

  it('removes only other versions of its own caches', () => {
    expect(isOldCache('chw-0.8.0+0000000', '0.9.0+a1b2c3d')).toBe(true);
    expect(isOldCache('chw-0.9.0+a1b2c3d', '0.9.0+a1b2c3d')).toBe(false);
    expect(isOldCache('someone-else', '0.9.0+a1b2c3d')).toBe(false);
  });

  it('precaches every shell file by its full address', () => {
    expect(shellRequests(SCOPE, SHELL)).toEqual([
      `${SCOPE}index.html`,
      `${SCOPE}manifest.webmanifest`,
      `${SCOPE}icons/icon-192.png`,
    ]);
  });

  it('serves the cached page for any navigation inside the app', () => {
    expect(route(get(SCOPE, 'navigate'), SCOPE, SHELL)).toBe('page');
    expect(route(get(`${SCOPE}index.html`, 'navigate'), SCOPE, SHELL)).toBe('page');
    expect(route(get(`${SCOPE}?source=pwa`, 'navigate'), SCOPE, SHELL)).toBe('page');
  });

  it('serves shell files from the cache, ignoring query and hash', () => {
    expect(route(get(`${SCOPE}manifest.webmanifest`), SCOPE, SHELL)).toBe('shell');
    expect(route(get(`${SCOPE}icons/icon-192.png?v=2#x`), SCOPE, SHELL)).toBe('shell');
  });

  it('leaves everything else to the network', () => {
    expect(route(get(`${SCOPE}sw.js`), SCOPE, SHELL)).toBeNull();
    expect(route(get(`${SCOPE}icons/other.png`), SCOPE, SHELL)).toBeNull();
    expect(route(get('https://example.com/chw-timesheet/', 'navigate'), SCOPE, SHELL)).toBeNull();
    expect(route(get('https://regensonora.github.io/other/', 'navigate'), SCOPE, SHELL)).toBeNull();
    expect(
      route({ method: 'POST', url: `${SCOPE}index.html`, mode: 'navigate' }, SCOPE, SHELL),
    ).toBeNull();
  });
});
