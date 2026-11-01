// Service worker (SPEC §2 "Offline", decision 0014). Caches the app shell on install and serves
// it with no signal. A new release installs in the background and waits; the page shows
// "Updated, tap to reload" and sends SKIP_WAITING when the CHW taps it.
// scripts/build.mjs defines __APP_VERSION__ and __SHELL__ (the files in dist/ besides sw.js).
import { cacheName, isOldCache, route, shellRequests } from './sw-shell';
import { SKIP_WAITING } from './sw-messages';

declare const __SHELL__: string[];

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface MessageEvent extends ExtendableEvent {
  data: unknown;
}

interface ServiceWorkerScope {
  registration: { scope: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

const sw = self as unknown as ServiceWorkerScope;
const CACHE = cacheName(__APP_VERSION__);
const scope = () => sw.registration.scope;

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // 'reload' skips the HTTP cache, so a new release never stores the previous page.
      cache.addAll(
        shellRequests(scope(), __SHELL__).map((url) => new Request(url, { cache: 'reload' })),
      ),
    ),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => isOldCache(n, __APP_VERSION__)).map((n) => caches.delete(n)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  const how = route(request, scope(), __SHELL__);
  if (!how) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached =
        how === 'page'
          ? await cache.match(new URL('index.html', scope()).href)
          : await cache.match(request, { ignoreSearch: true });
      return cached ?? fetch(request);
    }),
  );
});

sw.addEventListener('message', (event) => {
  if (event.data === SKIP_WAITING) event.waitUntil(sw.skipWaiting());
});
