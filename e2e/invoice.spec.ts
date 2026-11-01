// Invoices (SPEC §6–§8, decisions 0007, 0012): preview, create files, share, re-share.
import { expect, test, type Page } from '@playwright/test';
import { readPdf } from '../tests/files/pdf-reader.js';
import { addEntry, heading, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

interface SharedFile {
  name: string;
  type: string;
  bytes: number[];
}

/** Replace the share sheet with one that records the files, as a phone's would receive them. */
async function stubShare(page: Page): Promise<void> {
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
async function noShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
}

const sharedFiles = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: SharedFile[][] }).__shared);

const DATES = [
  '2026-10-20',
  '2026-10-22',
  '2026-10-23',
  '2026-10-26',
  '2026-10-27',
  '2026-10-28',
  '2026-10-29',
  '2026-10-30',
];

test('create, share and re-share an invoice', async ({ page }) => {
  test.setTimeout(120_000);
  await stubShare(page);
  await setUp(page);
  for (const date of DATES) await addEntry(page, { date, start: '09:00', end: '10:00' });

  await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
  await expect(heading(page, 'New invoice')).toBeVisible();
  await expect(page.getByText(/^CC-\d{4}-001$/)).toBeVisible();
  await expect(page.getByText('8 on 8 dates (2 timesheet pages)')).toBeVisible();
  await expect(page.getByText('$20.00 / h')).toBeVisible();
  await expect(page.getByRole('row', { name: 'CHW referrals 8.00 h $160.00' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Total 8.00 h $160.00' })).toBeVisible();
  await expect(page.getByText('Enter your not-to-exceed amount in Settings.')).toBeVisible();
  await expect(page.getByText('These 8 entries will be locked.')).toBeVisible();

  await page.getByRole('button', { name: 'Create invoice files' }).click();
  await expect(heading(page, 'Invoice created')).toBeVisible();
  await expect(page.getByText(/^Invoice CC-\d{4}-001 is ready$/)).toBeVisible();
  await expect(page.getByText('8 entries are now locked.')).toBeVisible();
  const number = ((await page.getByText(/^Invoice CC-\d{4}-001 is ready$/).textContent()) ?? '')
    .replace('Invoice ', '')
    .replace(' is ready', '');
  const names = [
    `TISUPP_${number}_2026-10-20_to_2026-10-30.pdf`,
    `TISUPP_${number}_timesheet.csv`,
    `TISUPP_${number}_entries.csv`,
  ];
  for (const name of names) await expect(page.getByText(name)).toBeVisible();

  await page.getByRole('button', { name: 'Share files' }).click();
  await expect(page.getByRole('status')).toHaveText('Files shared.');
  const [first] = await sharedFiles(page);
  expect(first?.map((f) => [f.name, f.type])).toEqual([
    [names[0], 'application/pdf'],
    [names[1], 'text/csv'],
    [names[2], 'text/csv'],
  ]);
  const pdf = await readPdf(new Uint8Array(first?.[0]?.bytes ?? []));
  expect(pdf).toHaveLength(3);
  expect(pdf[0]?.text).toContain('CHW referrals 8.00 $20.00 $160.00');
  expect(pdf[0]?.text).toContain('Amount due 8.00 $160.00');
  expect(pdf[0]?.text).toContain(`${number} · Page 1 of 3`);
  expect(pdf[1]?.text).toContain('Dates worked 1–7 of 8');

  // Back on Home, the entries are locked away.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect(page.getByText('No TISUPP entries waiting.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate TISUPP invoice' })).toHaveCount(0);

  // Re-share from Settings › Past invoices: the same bytes (SPEC §6).
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Past invoices/ }).click();
  await expect(heading(page, 'Past invoices')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(number) }).click();
  await expect(heading(page, `Invoice ${number}`)).toBeVisible();
  await page.getByRole('button', { name: 'Share files' }).click();
  await expect(page.getByRole('status')).toHaveText('Files shared.');
  const [, again] = await sharedFiles(page);
  expect(again).toEqual(first);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(heading(page, 'Past invoices')).toBeVisible();

  // The next invoice takes the next number.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await addEntry(page, { date: '2026-10-31', start: '09:00', end: '10:00' });
  await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
  await expect(page.getByText(/^CC-\d{4}-002$/)).toBeVisible();
});

test('without file sharing, the files download; leaving unshared asks first', async ({ page }) => {
  await noShare(page);
  await setUp(page);
  await addEntry(page, { date: '2026-10-30', start: '09:12', end: '10:37' });
  await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
  await page.getByRole('button', { name: 'Create invoice files' }).click();
  await expect(heading(page, 'Invoice created')).toBeVisible();

  // The phone's back gesture asks before leaving a new invoice unshared.
  await page.goBack();
  const leave = page.getByRole('dialog', { name: 'Leave without sharing?' });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Stay' }).click();
  await expect(heading(page, 'Invoice created')).toBeVisible();

  // So does Done; sharing from the question downloads the three files.
  await page.getByRole('button', { name: 'Done' }).click();
  const ask = page.getByRole('dialog', { name: 'Share the files first?' });
  await expect(ask).toContainText('You can share them later from Settings › Past invoices.');
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  await ask.getByRole('button', { name: 'Share files' }).click();
  await expect(page.getByRole('status')).toContainText('Files saved to your downloads.');
  await expect.poll(() => downloads.length).toBe(3);
  expect(downloads.map((n) => n.replace(/CC-\d{4}-/, 'CC-YYYY-')).sort()).toEqual([
    'TISUPP_CC-YYYY-001_2026-10-30_to_2026-10-30.pdf',
    'TISUPP_CC-YYYY-001_entries.csv',
    'TISUPP_CC-YYYY-001_timesheet.csv',
  ]);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
});

test('Done anyway leaves an unshared invoice; it stays in Past invoices', async ({ page }) => {
  await stubShare(page);
  await setUp(page);
  await addEntry(page, { date: '2026-10-30', start: '09:12', end: '10:37' });
  await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
  await page.getByRole('button', { name: 'Create invoice files' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done anyway' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: /Past invoices 1 invoice/ })).toBeVisible();
});
