// Persistent storage request and status (SPEC §2).
import { describe, expect, it } from 'vitest';
import { persistenceStatus, requestPersistence } from '../../src/storage/persist';

function stub(state: { persisted: boolean; grant: boolean; fail?: boolean }) {
  return {
    storage: {
      persisted: () =>
        state.fail ? Promise.reject(new Error('no')) : Promise.resolve(state.persisted),
      persist: () => {
        if (state.grant) state.persisted = true;
        return Promise.resolve(state.grant);
      },
    },
  };
}

describe('persistent storage', () => {
  it('asks and reports persisted when granted', async () => {
    const nav = stub({ persisted: false, grant: true });
    expect(await persistenceStatus(nav)).toBe('not_persisted');
    expect(await requestPersistence(nav)).toBe('persisted');
    expect(await persistenceStatus(nav)).toBe('persisted');
  });

  it('reports not persisted when refused', async () => {
    const nav = stub({ persisted: false, grant: false });
    expect(await requestPersistence(nav)).toBe('not_persisted');
    expect(await persistenceStatus(nav)).toBe('not_persisted');
  });

  it('does not ask again once persisted', async () => {
    let asked = 0;
    const nav = {
      storage: {
        persisted: () => Promise.resolve(true),
        persist: () => {
          asked++;
          return Promise.resolve(true);
        },
      },
    };
    expect(await requestPersistence(nav)).toBe('persisted');
    expect(asked).toBe(0);
  });

  it('reports unsupported without the Storage API', async () => {
    expect(await requestPersistence({})).toBe('unsupported');
    expect(await persistenceStatus({})).toBe('unsupported');
    expect(await persistenceStatus(undefined)).toBe('unsupported');
  });

  it('treats an error as not persisted', async () => {
    const nav = stub({ persisted: false, grant: false, fail: true });
    expect(await persistenceStatus(nav)).toBe('not_persisted');
    expect(await requestPersistence(nav)).toBe('not_persisted');
  });
});
