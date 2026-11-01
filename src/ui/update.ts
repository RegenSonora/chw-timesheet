// The update flow (SPEC §2 "Offline", decision 0014): a new release downloads in the background;
// Home offers "Updated, tap to reload" when the CHW is not in the middle of an entry.
import { useEffect, useState } from 'preact/hooks';
import type { AppState } from '../storage';
import { SKIP_WAITING } from '../sw-messages';

/** An entry is being entered or edited, or a timer runs: never reload now. */
export function isMidEntry(app: Pick<AppState, 'draft' | 'running_timer'>): boolean {
  return app.draft !== null || app.running_timer !== null;
}

/** Check for a new release when the app comes back to the screen, at most this often. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

function ready(next: () => void) {
  apply = next;
  for (const listener of listeners) listener();
}

/** Loads the waiting release, or null while there is none. */
export function useUpdate(): (() => void) | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => {
      setTick((n) => n + 1);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return apply;
}

/** Register the service worker and report a new release once it has fully downloaded. */
export async function watchForUpdate(container: ServiceWorkerContainer): Promise<void> {
  const registration = await container.register('./sw.js', { scope: './' });
  let reloading = false;

  const offer = () => {
    const waiting = registration.waiting;
    // No controller means this is the first install, not an update.
    if (!waiting || !container.controller) return;
    ready(() => {
      container.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      waiting.postMessage(SKIP_WAITING);
    });
  };

  offer();
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') offer();
    });
  });

  let checked = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - checked < CHECK_EVERY_MS) return;
    checked = Date.now();
    registration.update().catch(() => undefined);
  });
}
