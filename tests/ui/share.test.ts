import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareFiles, toFiles, type DownloadHost, type ShareNavigator } from '../../src/ui/share';

const files = toFiles([
  { name: 'a.pdf', type: 'application/pdf', bytes: new Uint8Array([1, 2]) },
  { name: 'b.csv', type: 'text/csv', bytes: new Uint8Array([3]) },
]);

function fakeHost() {
  const clicked: string[] = [];
  const host: DownloadHost = {
    createElement: () => {
      const a = {
        href: '',
        download: '',
        rel: '',
        click: () => clicked.push(a.download),
        remove: () => undefined,
      };
      return a as unknown as HTMLAnchorElement;
    },
    body: { append: () => undefined },
    createObjectURL: (blob) => `blob:${(blob as File).name}`,
    revokeObjectURL: () => undefined,
  };
  return { host, clicked };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('shareFiles', () => {
  it('shares all files together when the phone can', async () => {
    const shared: ShareData[] = [];
    const nav: ShareNavigator = {
      canShare: () => true,
      share: (data) => {
        shared.push(data);
        return Promise.resolve();
      },
    };
    const { host, clicked } = fakeHost();
    expect(await shareFiles(files, 'Invoice CC-2026-004', nav, host)).toBe('shared');
    expect(shared[0]?.files?.map((f) => [f.name, f.type])).toEqual([
      ['a.pdf', 'application/pdf'],
      ['b.csv', 'text/csv'],
    ]);
    expect(shared[0]?.title).toBe('Invoice CC-2026-004');
    expect(clicked).toEqual([]);
  });

  it('reports a closed share sheet as cancelled, without downloading', async () => {
    const nav: ShareNavigator = {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('closed', 'AbortError')),
    };
    const { host, clicked } = fakeHost();
    expect(await shareFiles(files, 't', nav, host)).toBe('cancelled');
    expect(clicked).toEqual([]);
  });

  it('downloads each file when files cannot be shared', async () => {
    vi.useFakeTimers();
    for (const nav of [{}, { canShare: () => false, share: () => Promise.resolve() }]) {
      const { host, clicked } = fakeHost();
      expect(await shareFiles(files, 't', nav, host)).toBe('downloaded');
      expect(clicked).toEqual(['a.pdf', 'b.csv']);
    }
  });

  it('falls back to downloads when sharing fails for another reason', async () => {
    vi.useFakeTimers();
    const nav: ShareNavigator = {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('no gesture', 'NotAllowedError')),
    };
    const { host, clicked } = fakeHost();
    expect(await shareFiles(files, 't', nav, host)).toBe('downloaded');
    expect(clicked).toEqual(['a.pdf', 'b.csv']);
  });
});
