// M0 service worker: registers and takes control, but caches nothing and has no fetch handler.
// scripts/build.mjs stamps the app version in a banner comment so each release is a new file.
// The offline cache and update flow arrive in M5 (BUILD_PLAN M5, SPEC §2).

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface ServiceWorkerScope {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
}

const sw = self as unknown as ServiceWorkerScope;

sw.addEventListener('install', (event) => {
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(sw.clients.claim());
});
