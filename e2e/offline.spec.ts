// SPEC §2 "Offline": after the first load the app opens and saves with no signal.
import { expect, test } from '@playwright/test';
import { addEntry, heading, setUp, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

test('opens and saves entries with no signal after the first load', async ({ page, context }) => {
  await setUp(page);
  await addEntry(page, { date: '2026-10-30', start: '09:00', end: '10:00' });
  // The worker has cached the shell once it controls the page.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect(page.getByText('1 entry · 1 h · $20.00')).toBeVisible();

  await addEntry(page, { date: '2026-10-31', start: '09:00', end: '10:30' });
  await expect(page.getByText('2 entries · 2.5 h · $50.00')).toBeVisible();

  // A cold start from a closed app, still offline.
  const again = await context.newPage();
  await again.goto('./');
  await expect(heading(again, 'CHW Time Tracker')).toBeVisible();
  await expect(again.getByText('2 entries · 2.5 h · $50.00')).toBeVisible();
});
