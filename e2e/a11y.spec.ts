// WCAG 2.1 AA (axe) on every M3 screen, in light and dark (SPEC §10).
import { expect, test } from '@playwright/test';
import { addEntry, expectAccessible, heading, pickTaskAndLine, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('every screen passes axe', async ({ page }) => {
      // One long walk through every screen, with an axe run on each.
      test.setTimeout(120_000);
      await page.goto('./');
      await expect(heading(page, 'Set up')).toBeVisible();
      await expectAccessible(page, 'setup');

      await setUp(page, { regen: true });
      await expectAccessible(page, 'home, empty');

      await page.getByRole('button', { name: /Funding source TISUPP/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectAccessible(page, 'source picker');
      await page.getByRole('button', { name: 'Cancel' }).click();

      await page.getByRole('button', { name: 'Enter times instead' }).click();
      await page.getByLabel('Date').fill('2026-10-30');
      await page.getByLabel('Start').fill('09:12');
      await page.getByLabel('End').fill('10:37');
      await expectAccessible(page, 'enter times');
      await page.getByRole('button', { name: 'Next' }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByText('Pick what you did.')).toBeVisible();
      await expectAccessible(page, 'task step with errors');
      await pickTaskAndLine(page, 'Client check in', 'CHW referrals');
      await page.getByRole('button', { name: '+ Add another count' }).click();
      await expectAccessible(page, 'counts step');
      await page.getByRole('button', { name: 'Remove this count' }).click();
      await page.getByRole('button', { name: 'Save entry' }).click();
      await expect(page.getByRole('status')).toContainText('Saved');
      await expectAccessible(page, 'home with entry and toast');

      await page.getByRole('button', { name: /Client check in/ }).click();
      await expect(heading(page, 'Edit entry')).toBeVisible();
      await expectAccessible(page, 'edit entry');
      await page.getByRole('button', { name: 'Back' }).click();

      for (const [date, start] of [
        ['2026-10-27', '09:00'],
        ['2026-10-28', '09:00'],
        ['2026-10-29', '09:00'],
      ] as const) {
        await addEntry(page, { date, start, end: '10:00' });
      }
      await page.getByRole('button', { name: 'Show all 4 entries' }).click();
      await expectAccessible(page, 'all entries');
      await page.getByRole('button', { name: 'Back' }).click();

      await page.getByRole('button', { name: 'Settings' }).click();
      await expectAccessible(page, 'settings');
      await page.getByLabel('Hourly rate for TISUPP').fill('22.00');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectAccessible(page, 'rate change dialog');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByLabel('Hourly rate for TISUPP').fill('20.00');
      await page.getByRole('button', { name: 'Back' }).click();

      await page.getByRole('button', { name: 'Start timer' }).click();
      await expect(page.getByRole('timer')).toBeVisible();
      await expectAccessible(page, 'timer running');
      await page.getByRole('button', { name: 'Discard timer' }).click();
      await expectAccessible(page, 'discard dialog');
      await page.getByRole('dialog').getByRole('button', { name: 'Discard timer' }).click();

      // Invoices (M4): preview, created, the unshared question, past invoices.
      await page.getByRole('button', { name: 'Generate TISUPP invoice' }).click();
      await expect(heading(page, 'New invoice')).toBeVisible();
      await expectAccessible(page, 'invoice preview');
      await page.getByRole('button', { name: 'Create invoice files' }).click();
      await expect(heading(page, 'Invoice created')).toBeVisible();
      await expectAccessible(page, 'invoice created');
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectAccessible(page, 'share first dialog');
      await page.getByRole('dialog').getByRole('button', { name: 'Done anyway' }).click();
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('button', { name: /Past invoices/ }).click();
      await expect(heading(page, 'Past invoices')).toBeVisible();
      await expectAccessible(page, 'past invoices');
      await page.getByRole('button', { name: /CC-\d{4}-001/ }).click();
      await expect(heading(page, /^Invoice CC-/)).toBeVisible();
      await expectAccessible(page, 're-share invoice');
    });
  });
}

test('install gate passes axe', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('./');
  await expect(heading(page, 'Add CHW Time Tracker to your Home Screen')).toBeVisible();
  await expectAccessible(page, 'install gate');
  await context.close();
});
