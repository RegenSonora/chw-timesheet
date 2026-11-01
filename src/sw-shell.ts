// What the service worker caches and serves (SPEC §2 "Offline"). Pure, so it is unit tested.

const PREFIX = 'chw-';

/** One cache per release, so a waiting new version never mixes files with the running one. */
export function cacheName(version: string): string {
  return `${PREFIX}${version}`;
}

/** A cache left by an earlier release of this app. */
export function isOldCache(name: string, version: string): boolean {
  return name.startsWith(PREFIX) && name !== cacheName(version);
}

/** Full addresses of the shell files, relative paths resolved against the worker's scope. */
export function shellRequests(scope: string, shell: readonly string[]): string[] {
  return shell.map((path) => new URL(path, scope).href);
}

export interface RequestInfo {
  method: string;
  url: string;
  mode: string;
}

/**
 * How the worker answers a request: 'page' serves the cached index.html (every navigation
 * inside the app), 'shell' serves a cached shell file, null leaves it to the network.
 */
export function route(
  request: RequestInfo,
  scope: string,
  shell: readonly string[],
): 'page' | 'shell' | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  if (!url.href.startsWith(scope)) return null;
  if (request.mode === 'navigate') return 'page';
  return shell.includes(url.href.slice(scope.length)) ? 'shell' : null;
}
