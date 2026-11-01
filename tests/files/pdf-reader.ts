// Opens a PDF with pdf.js (dev dependency only) the way a PDF reader app would, and returns each
// page's size and selectable text.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface ReadPage {
  width: number;
  height: number;
  /** Text items joined with spaces, in drawing order. */
  text: string;
  items: string[];
}

export async function readPdf(bytes: Uint8Array): Promise<ReadPage[]> {
  // pdf.js takes ownership of the buffer, so give it a copy.
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const doc = await task.promise;
  const pages: ReadPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const [, , width = 0, height = 0] = page.view;
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => ('str' in item && item.str ? [item.str] : []));
    pages.push({ width, height, text: items.join(' ').replace(/\s+/g, ' ').trim(), items });
  }
  await task.destroy();
  return pages;
}
