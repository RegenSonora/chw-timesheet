// Enter times (SPEC §5, decision 0004): overlap blocked, back-to-back allowed, next day.
import { expect, test } from '@playwright/test';
import { addEntry, heading, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

test.beforeEach(async ({ page }) => {
  await setUp(page);
  await addEntry(page, {
    date: '2026-10-29',
    start: '13:15',
    end: '15:00',
    task: 'Client follow up',
  });
  await page.getByRole('button', { name: 'Enter times instead' }).click();
  await expect(heading(page, 'Enter times')).toBeVisible();
  await page.getByLabel('Date').fill('2026-10-29');
});

test('an overlap is blocked with a plain message', async ({ page }) => {
  await page.getByLabel('Start').fill('14:30');
  await page.getByLabel('End').fill('16:00');
  await expect(page.getByRole('alert')).toHaveText(
    'This overlaps your 1:15–3:00 PM entry on Oct 29 (Client follow up). Change the times to continue.',
  );
  await expect(page.getByLabel('Start')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('back-to-back is allowed', async ({ page }) => {
  await page.getByLabel('Start').fill('15:00');
  await page.getByLabel('End').fill('16:00');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('1 h', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
});

test('an end before the start ends the next day', async ({ page }) => {
  await page.getByLabel('Start').fill('23:00');
  await page.getByLabel('End').fill('01:00');
  await expect(page.getByText(/Ends the next day\./)).toBeVisible();
  await expect(page.getByText('2 h', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Thu, Oct 29 · 11:00 PM–1:00 AM (next day)')).toBeVisible();
});

test('under 7.5 minutes is too short', async ({ page }) => {
  await page.getByLabel('Start').fill('09:00');
  await page.getByLabel('End').fill('09:07');
  await expect(page.getByRole('alert')).toContainText("That's under 8 minutes, too short to bill.");
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});
