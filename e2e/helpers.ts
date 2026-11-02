// Shared steps for the e2e tests: a fresh phone, setup, entries and axe checks.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import jsqr from 'jsqr';

// jsqr is CommonJS: under NodeNext its default export arrives as .default.
const jsQR = ((jsqr as unknown as { default?: unknown }).default ?? jsqr) as typeof jsqr.default;

/** Arizona: no daylight saving, so labels are stable (CLAUDE.md data conventions). */
export const ZONE = 'America/Phoenix';

/** Run axe with WCAG 2.1 A and AA rules; fail on any violation. */
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    where,
  ).toEqual([]);
}

export function heading(page: Page, name: string | RegExp) {
  return page.getByRole('heading', { level: 1, name });
}

/** Fill in setup with TISUPP at $20.00 (and REGEN-GO at $18.00 when asked). */
export async function setUp(page: Page, options: { regen?: boolean } = {}): Promise<void> {
  await page.goto('./');
  await expect(heading(page, 'Set up')).toBeVisible();
  await page.getByLabel('Your name').fill('Carmen Cruz');
  await page.getByLabel('Initials').fill('cc');
  if (options.regen) {
    await page.getByRole('checkbox', { name: /REGEN-GO/ }).check();
    await page.getByLabel('Hourly rate for REGEN-GO').fill('18.00');
  }
  await page.getByRole('button', { name: 'Save and start' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
}

/** Enter times → task and budget line → Save, from Home. */
export async function addEntry(
  page: Page,
  entry: {
    date: string;
    start: string;
    end: string;
    task?: string;
    line?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'Record time' }).click();
  await expect(heading(page, 'Enter times')).toBeVisible();
  // In WebKit a fill right after the screen mounts sometimes fires no input event, and the
  // field shows today's date again. Fill until all three values stick.
  await expect(async () => {
    await page.getByLabel('Date').fill(entry.date);
    await page.getByLabel('Start').fill(entry.start);
    await page.getByLabel('End').fill(entry.end);
    await expect(page.getByLabel('Date')).toHaveValue(entry.date, { timeout: 500 });
    await expect(page.getByLabel('Start')).toHaveValue(entry.start, { timeout: 500 });
    await expect(page.getByLabel('End')).toHaveValue(entry.end, { timeout: 500 });
  }).toPass();
  await page.getByRole('button', { name: 'Next' }).click();
  await pickTaskAndLine(page, entry.task ?? 'Client check in', entry.line ?? 'CHW referrals');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
}

export function taskBox(page: Page, task: string) {
  return page.getByRole('checkbox', { name: new RegExp(`^${task}`) });
}

/** Open the budget line picker and pick a line. */
export async function pickLine(page: Page, line: string): Promise<void> {
  await page
    .locator('.field', { has: page.getByText('Budget line', { exact: true }) })
    .getByRole('button')
    .click();
  await page.getByRole('dialog').getByRole('button', { name: line, exact: true }).click();
}

/**
 * Pick a budget line, check one task and go on: the task gets all the hours, so there is no
 * split step (decision 0024).
 */
export async function pickTaskAndLine(page: Page, task: string, line: string): Promise<void> {
  await expect(heading(page, 'What did you do?')).toBeVisible();
  await pickLine(page, line);
  await taskBox(page, task).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'Counts and notes')).toBeVisible();
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
}

// --- Sharing ------------------------------------------------------------------------------

export interface SharedFile {
  name: string;
  type: string;
  bytes: number[];
}

/** Replace the share sheet with one that records the files, as a phone's would receive them. */
export async function stubShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shared: unknown[][] = [];
    Object.assign(window, { __shared: shared });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const files = await Promise.all(
          (data.files ?? []).map(async (f) => ({
            name: f.name,
            type: f.type,
            bytes: [...new Uint8Array(await f.arrayBuffer())],
          })),
        );
        shared.push(files);
      },
    });
  });
}

/** A browser that can't share files: the app falls back to downloads. */
export async function noShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
}

/** Every share so far, oldest first. */
export const sharedFiles = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: SharedFile[][] }).__shared);

/**
 * Open a shared PNG in the browser, as a photo app would: its size, and the QR code read from
 * the bottom-right corner of the page (decision 0018).
 */
export async function readPng(
  page: Page,
  bytes: readonly number[],
): Promise<{ width: number; height: number; qr: string | null }> {
  const crop = 700;
  const seen = await page.evaluate(
    async ({ bytes, crop }) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
      );
      const canvas = document.createElement('canvas');
      canvas.width = crop;
      canvas.height = crop;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(image, crop - image.width, crop - image.height);
      const rgba = ctx.getImageData(0, 0, crop, crop).data;
      let binary = '';
      for (let i = 0; i < rgba.length; i += 0x8000) {
        binary += String.fromCharCode(...rgba.subarray(i, i + 0x8000));
      }
      return { width: image.width, height: image.height, rgba: btoa(binary) };
    },
    { bytes: [...bytes], crop },
  );
  const rgba = new Uint8ClampedArray(Buffer.from(seen.rgba, 'base64'));
  return { width: seen.width, height: seen.height, qr: jsQR(rgba, crop, crop)?.data ?? null };
}

// --- CSV ----------------------------------------------------------------------------------

/** Parse RFC 4180 CSV (UTF-8 with BOM, CRLF) into rows of fields. Throws on a malformed file. */
export function parseCsv(bytes: number[]): string[][] {
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(new Uint8Array(bytes));
  if (!text.startsWith('\uFEFF')) throw new Error('CSV has no byte-order mark');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 1; i < text.length; i++) {
    const c = text[i] ?? '';
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      if (field !== '') throw new Error(`Quote inside an unquoted field at ${String(i)}`);
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quote');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
