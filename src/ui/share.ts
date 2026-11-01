// Sharing the invoice files (SPEC §7): the phone's share sheet with all three files, or a
// download of each where sharing files isn't supported.
import type { InvoiceFile } from '../files';

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

/** The parts of `navigator` sharing uses; tests pass a fake. */
export interface ShareNavigator {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

/** The parts of `document` and `URL` the download fallback uses. */
export interface DownloadHost {
  createElement(tag: 'a'): HTMLAnchorElement;
  body: { append(node: Node): void };
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export function toFiles(files: readonly InvoiceFile[]): File[] {
  return files.map((f) => new File([f.bytes], f.name, { type: f.type }));
}

function download(files: readonly File[], host: DownloadHost): void {
  for (const file of files) {
    const url = host.createObjectURL(file);
    const a = host.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    host.body.append(a);
    a.click();
    a.remove();
    // Long enough for the browser to start the download.
    setTimeout(() => {
      host.revokeObjectURL(url);
    }, 60_000);
  }
}

const browserHost = (): DownloadHost => ({
  createElement: (tag) => document.createElement(tag),
  body: document.body,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => {
    URL.revokeObjectURL(url);
  },
});

/**
 * Must run straight from a tap: the share sheet needs the user's gesture. "cancelled" means the
 * CHW closed the share sheet; any other share failure falls back to downloads.
 */
export async function shareFiles(
  files: readonly File[],
  title: string,
  nav: ShareNavigator = navigator,
  host: DownloadHost = browserHost(),
): Promise<ShareOutcome> {
  const data: ShareData = { files: [...files], title };
  if (nav.share && nav.canShare?.(data)) {
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  download(files, host);
  return 'downloaded';
}
