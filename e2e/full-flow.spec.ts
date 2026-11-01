// The whole job end to end (BUILD_PLAN M5): setup → entries over 9 dates → invoice → files →
// re-share, with axe on each screen (SPEC §5–§8, §10).
import { expect, test, type Page } from '@playwright/test';
import { readPdf } from '../tests/files/pdf-reader.js';
import {
  addEntry,
  expectAccessible,
  heading,
  parseCsv,
  pickTaskAndLine,
  setUp,
  sharedFiles,
  stubShare,
  ZONE,
} from './helpers.js';

test.use({ timezoneId: ZONE });

async function pickSource(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: /^Funding source .+\. Change$/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${code}`) })
    .click();
  await expect(page.getByRole('button', { name: `Funding source ${code}. Change` })).toBeVisible();
}

/** TISUPP entries typed in, on 8 dates; the timer adds the 9th. 10.5 h. */
const TYPED = [
  { date: '2026-10-19', start: '09:00', end: '10:00' },
  {
    date: '2026-10-20',
    start: '13:00',
    end: '14:30',
    task: 'Outreach',
    line: 'Outreach and marketing',
  },
  { date: '2026-10-21', start: '09:00', end: '09:45' },
  {
    date: '2026-10-22',
    start: '10:00',
    end: '12:00',
    task: 'Training / continuing education',
    line: 'New CHWs: training, stipends, field hours',
  },
  // Crosses midnight: belongs to its start date (SPEC §5).
  { date: '2026-10-23', start: '22:30', end: '00:15' },
  {
    date: '2026-10-26',
    start: '09:00',
    end: '10:00',
    task: 'Outreach',
    line: 'Outreach and marketing',
  },
  { date: '2026-10-27', start: '09:00', end: '11:00' },
  {
    date: '2026-10-28',
    start: '09:00',
    end: '09:30',
    task: 'Outreach',
    line: 'Outreach and marketing',
  },
];

test('setup → 9 dates of entries → invoice → files → re-share', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.install({ time: new Date('2026-10-30T09:00:00-07:00') });
  await stubShare(page);

  await page.goto('./');
  await expect(heading(page, 'Set up')).toBeVisible();
  await expectAccessible(page, 'setup');
  await setUp(page, { regen: true });
  await expectAccessible(page, 'home, empty');

  // A timed entry with counts and notes: Oct 30, 9:00–10:30.
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await expectAccessible(page, 'timer running');
  await page.clock.fastForward('01:30:00');
  await page.getByRole('button', { name: 'Stop' }).click();
  await expectAccessible(page, 'task step');
  await pickTaskAndLine(page, 'Client check in', 'CHW referrals');
  await page.getByRole('button', { name: 'More contacts' }).click();
  await page.getByRole('button', { name: 'More contacts' }).click();
  await page.getByRole('button', { name: 'More referrals given' }).click();
  await page.getByLabel('Notes (optional)').fill('Met at the clinic, follow up next week');
  await expectAccessible(page, 'counts step');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();

  for (const entry of TYPED) await addEntry(page, entry);
  await expect(page.getByText('9 entries · 12 h · $240.00')).toBeVisible();

  // One REGEN-GO entry stays off the TISUPP invoice.
  await pickSource(page, 'REGEN-GO');
  await addEntry(page, {
    date: '2026-10-29',
    start: '13:00',
    end: '14:00',
    task: 'Outreach',
    line: 'Outreach and marketing',
  });
  await expect(page.getByText('1 entry · 1 h · $18.00')).toBeVisible();
  await pickSource(page, 'TISUPP');
  await expectAccessible(page, 'home with entries');

  // Preview.
  await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
  await expect(heading(page, 'New invoice')).toBeVisible();
  await expect(page.getByText('CC-2026-001')).toBeVisible();
  await expect(page.getByText('9 on 9 dates (2 timesheet pages)')).toBeVisible();
  await expect(
    page.getByRole('row', { name: 'New CHWs: training, stipends, field hours 2.00 h $40.00' }),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: 'CHW referrals 7.00 h $140.00' })).toBeVisible();
  await expect(
    page.getByRole('row', { name: 'Outreach and marketing 3.00 h $60.00' }),
  ).toBeVisible();
  await expect(page.getByRole('row', { name: 'Total 12.00 h $240.00' })).toBeVisible();
  await expectAccessible(page, 'invoice preview');

  // Create and share.
  await page.getByRole('button', { name: 'Create invoice files' }).click();
  await expect(heading(page, 'Invoice created')).toBeVisible();
  await expect(page.getByText('9 entries are now locked.')).toBeVisible();
  await expectAccessible(page, 'invoice created');
  await page.getByRole('button', { name: 'Share files' }).click();
  await expect(page.getByRole('status')).toHaveText('Files shared.');
  const [first] = await sharedFiles(page);
  expect(first?.map((f) => f.name)).toEqual([
    'TISUPP_CC-2026-001_2026-10-19_to_2026-10-30.pdf',
    'TISUPP_CC-2026-001_timesheet.csv',
    'TISUPP_CC-2026-001_entries.csv',
  ]);
  const [pdfFile, timesheetFile, entriesFile] = first ?? [];

  // Entry log CSV: one row per TISUPP entry, all sharing one fingerprint.
  const [header = [], ...rows] = parseCsv(entriesFile?.bytes ?? []);
  const col = (name: string) => header.indexOf(name);
  expect(rows).toHaveLength(9);
  expect(new Set(rows.map((r) => r[col('funding_source')]))).toEqual(new Set(['TISUPP']));
  const billed = rows.reduce((sum, r) => sum + Number(r[col('billed_hours')]) * 4, 0);
  expect(billed).toBe(48);
  const midnight = rows.find((r) => r[col('start')] === '2026-10-23T22:30:00-07:00');
  expect(midnight?.[col('entry_date')]).toBe('2026-10-23');
  expect(midnight?.[col('billed_hours')]).toBe('1.75');
  const timed = rows.find((r) => r[col('entry_date')] === '2026-10-30');
  expect(timed?.[col('contacts')]).toBe('2');
  expect(timed?.[col('notes')]).toBe('Met at the clinic, follow up next week');
  const fingerprints = new Set(rows.map((r) => r[col('fingerprint')]));
  expect(fingerprints.size).toBe(1);
  const fingerprint = [...fingerprints][0] ?? '';
  expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);

  // Timesheet CSV: two pages of up to 7 dates, same fingerprint.
  const sheet = parseCsv(timesheetFile?.bytes ?? []);
  expect(sheet.filter((r) => r[0] === 'Task')).toHaveLength(2);
  expect(sheet.find((r) => r[0] === 'Fingerprint')?.[1]).toBe(fingerprint);

  // PDF: invoice page plus two timesheet pages, short fingerprint printed.
  const pdf = await readPdf(new Uint8Array(pdfFile?.bytes ?? []));
  expect(pdf).toHaveLength(3);
  expect(pdf[0]?.text).toContain('Amount due 12.00 $240.00');
  expect(pdf[0]?.text).toContain(
    `Fingerprint ${`${fingerprint.slice(0, 4)}-${fingerprint.slice(4, 8)}`.toUpperCase()}`,
  );
  expect(pdf[1]?.text).toContain('Dates worked 1–7 of 9');
  expect(pdf[2]?.text).toContain('Dates worked 8–9 of 9');

  // Home: TISUPP is clear; REGEN-GO still waits.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('No TISUPP entries waiting.', { exact: false })).toBeVisible();
  await pickSource(page, 'REGEN-GO');
  await expect(page.getByText('1 entry · 1 h · $18.00')).toBeVisible();

  // Re-share from Settings › Past invoices: the same bytes (SPEC §6).
  await page.getByRole('button', { name: 'Settings' }).click();
  await expectAccessible(page, 'settings');
  await page.getByRole('button', { name: /Past invoices/ }).click();
  await expect(heading(page, 'Past invoices')).toBeVisible();
  await expectAccessible(page, 'past invoices');
  await page.getByRole('button', { name: /CC-2026-001/ }).click();
  await expect(heading(page, 'Invoice CC-2026-001')).toBeVisible();
  await page.getByRole('button', { name: 'Share files' }).click();
  await expect(page.getByRole('status')).toHaveText('Files shared.');
  const [, again] = await sharedFiles(page);
  expect(again).toEqual(first);
});
