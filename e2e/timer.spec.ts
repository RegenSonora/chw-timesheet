// Timer rules (SPEC §5, decision 0009): survives reload, chip locked, discard confirms, too short.
import { expect, test } from '@playwright/test';
import { addEntry, heading, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

test('survives a reload with the chip locked', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByText('Timer running · TISUPP')).toBeVisible();
  const chip = page.getByRole('button', {
    name: 'Funding source TISUPP, locked while the timer runs',
  });
  await expect(chip).toBeDisabled();
});

test('Discard timer asks first', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByRole('button', { name: 'Discard timer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard this timer?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep timing' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Discard timer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard timer' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
});

test('a timer under 7.5 minutes is too short: keep timing or discard', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T09:00:00-07:00') });
  await setUp(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  // 7:00 leaves room for real time passing; the 449/450-second edge is a unit test.
  await page.clock.fastForward('07:00');
  await page.getByRole('button', { name: 'Stop' }).click();
  const dialog = page.getByRole('dialog', { name: 'Too short to bill' });
  await expect(dialog).toContainText("That's under 8 minutes, too short to bill.");
  await dialog.getByRole('button', { name: 'Keep timing' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^0:07:\d\d$/);

  // Past 7.5 minutes it rounds up to 0.25 h.
  await page.clock.fastForward('01:00');
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('0.25 h')).toBeVisible();
  await page.goBack();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard entry' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();

  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
});

test('a timer that overlaps an entry goes to Enter times to fix it', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T09:00:00-07:00') });
  await setUp(page);
  // Typed in ahead of time, so a timer started now runs into it.
  await addEntry(page, { date: '2026-10-30', start: '10:15', end: '10:30' });
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.fastForward('02:00:00');
  await page.getByRole('button', { name: 'Stop' }).click();
  const dialog = page.getByRole('dialog', { name: 'This time overlaps another entry' });
  await expect(dialog).toContainText(
    'This timer overlaps your 10:15–10:30 AM entry on Oct 30 (Client check in).',
  );
  await dialog.getByRole('button', { name: 'Fix the times' }).click();
  await expect(heading(page, 'Enter times')).toBeVisible();
  await expect(page.getByLabel('Start')).toHaveValue('09:00');
  await expect(page.getByLabel('End')).toHaveValue('11:00');
  await expect(page.getByRole('alert')).toContainText('This overlaps your 10:15–10:30 AM entry');
  await page.getByLabel('End').fill('10:15');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'New entry')).toBeVisible();
});
