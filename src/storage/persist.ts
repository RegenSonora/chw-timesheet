// Persistent storage (SPEC §2): ask the browser not to clear our data, and report the answer
// for Settings. The navigator is passed in so tests can use a stub.

export type PersistenceStatus = 'persisted' | 'not_persisted' | 'unsupported';

type StorageManagerLike = Pick<StorageManager, 'persist' | 'persisted'>;
type NavigatorLike = { storage?: StorageManagerLike | undefined };

function managerOf(nav: NavigatorLike | undefined): StorageManagerLike | null {
  const manager = nav?.storage;
  return manager && typeof manager.persisted === 'function' ? manager : null;
}

/** Ask once at setup. Returns the status afterwards. */
export async function requestPersistence(
  nav: NavigatorLike | undefined = globalThis.navigator,
): Promise<PersistenceStatus> {
  const manager = managerOf(nav);
  if (!manager || typeof manager.persist !== 'function') return 'unsupported';
  try {
    if (await manager.persisted()) return 'persisted';
    return (await manager.persist()) ? 'persisted' : 'not_persisted';
  } catch {
    return 'not_persisted';
  }
}

export async function persistenceStatus(
  nav: NavigatorLike | undefined = globalThis.navigator,
): Promise<PersistenceStatus> {
  const manager = managerOf(nav);
  if (!manager) return 'unsupported';
  try {
    return (await manager.persisted()) ? 'persisted' : 'not_persisted';
  } catch {
    return 'not_persisted';
  }
}
