// Update flow (SPEC §2, decision 0014): a new release downloads in the background; Home offers
// "Updated, tap to reload" only between entries, and tapping it loads the new release.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, heading, pickTaskAndLine, setUp, ZONE } from './helpers.js';

// A copy of dist/ on its own port per worker, so the test can publish a "new release" into it.
const BASE_PORT = Number(process.env['E2E_PORT'] ?? 4173) + 1;
const NEW_VERSION = '9.9.9+e2e0000';
let folder = '';
let server: ChildProcess | undefined;

test.use({
  timezoneId: ZONE,
  // Playwright requires the destructuring pattern for fixture functions.
  // eslint-disable-next-line no-empty-pattern
  baseURL: async ({}, use, testInfo) => {
    await use(`http://localhost:${String(BASE_PORT + testInfo.parallelIndex)}/chw-timesheet/`);
  },
});

// eslint-disable-next-line no-empty-pattern
test.beforeEach(async ({}, testInfo) => {
  const port = BASE_PORT + testInfo.parallelIndex;
  folder = mkdtempSync(join(tmpdir(), 'chw-update-'));
  cpSync('dist', folder, { recursive: true });
  const started = spawn(process.execPath, ['scripts/serve-dist.mjs', String(port), folder]);
  server = started;
  await new Promise<void>((done, fail) => {
    started.stdout.once('data', () => {
      done();
    });
    started.once('error', fail);
  });
});

test.afterEach(() => {
  server?.kill();
  rmSync(folder, { recursive: true, force: true });
});

/** Publish a new release: same app, new version stamp in sw.js. */
function publish(): void {
  const path = join(folder, 'sw.js');
  const sw = readFileSync(path, 'utf8');
  const version = /^\/\/ CHW Time Tracker (\S+)/.exec(sw)?.[1] ?? '';
  expect(version).not.toBe('');
  writeFileSync(path, sw.replaceAll(version, NEW_VERSION));
}

const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test('a new release is offered between entries and loads on tap', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T09:00:00-07:00') });
  await setUp(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const updateBar = page.getByRole('button', { name: 'Updated, tap to reload' });
  // The first install is not an update.
  await expect(updateBar).toHaveCount(0);

  // A timer is running when the new release arrives: no offer yet.
  await page.getByRole('button', { name: 'Start timer' }).click();
  publish();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.waiting?.state === 'installed';
  });
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(updateBar).toHaveCount(0);

  // Stop and save: back on Home, the offer appears.
  await page.clock.fastForward('30:00');
  await page.getByRole('button', { name: 'Stop' }).click();
  await pickTaskAndLine(page, 'Client check in', 'CHW referrals');
  await expect(updateBar).toHaveCount(0);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect(updateBar).toBeVisible();
  await expectAccessible(page, 'Home with the update offer');

  // Tap: the new release takes over and the page reloads with the entry still there.
  await Promise.all([page.waitForEvent('load'), updateBar.click()]);
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
  await expect.poll(() => cacheNames(page)).toEqual([`chw-${NEW_VERSION}`]);
  await expect(updateBar).toHaveCount(0);
  await expect(page.getByText('1 entry · 0.5 h · $10.00')).toBeVisible();
});
