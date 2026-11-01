// Settings (SPEC §4, decisions 0005, 0010): rate change check, adding a source, next number.
import { expect, test } from '@playwright/test';
import { addEntry, heading, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

test('changing the rate with entries waiting asks first', async ({ page }) => {
  await setUp(page);
  await addEntry(page, { date: '2026-10-30', start: '09:12', end: '10:37' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(heading(page, 'Settings')).toBeVisible();
  await page.getByLabel('Hourly rate for TISUPP').fill('22.00');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const dialog = page.getByRole('dialog', { name: 'Change your TISUPP rate to $22.00?' });
  await expect(dialog).toContainText(
    'You have 1 entry not yet invoiced. If you change the rate now, they will be billed at $22.00 instead of $20.00.',
  );
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(heading(page, 'Settings')).toBeVisible();

  await page.getByRole('button', { name: 'Save changes' }).click();
  // "Create invoice first" keeps the old rate and opens the invoice preview (SPEC §4).
  await page.getByRole('dialog').getByRole('button', { name: 'Create invoice first' }).click();
  await expect(heading(page, 'New invoice')).toBeVisible();
  await expect(page.getByText('$20.00 / h')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect(page.getByText('1 entry · 1.5 h · $30.00')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate TISUPP invoice' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Hourly rate for TISUPP').fill('22.00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Change rate now' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect(page.getByText('1 entry · 1.5 h · $33.00')).toBeVisible();
});

test('a funding source can be added later', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Add REGEN-GO' }).click();
  await page.getByLabel('Hourly rate for REGEN-GO').fill('18.00');
  await expect(page.getByText('No not-to-exceed amount for this funding source.')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');

  await page.getByRole('button', { name: /Funding source TISUPP/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^REGEN-GO/ })
    .click();
  await expect(page.getByRole('button', { name: /Funding source REGEN-GO/ })).toBeVisible();
});

test('NTE and next invoice number are saved', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Not-to-exceed amount for TISUPP').fill('5,000');
  await page.getByLabel(/Next invoice number/).fill('4');
  await expect(page.getByText(/Your next invoice will be CC-\d{4}-004\./)).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Not-to-exceed amount for TISUPP')).toHaveValue('5000.00');
  await expect(page.getByLabel(/Next invoice number/)).toHaveValue('4');
});
