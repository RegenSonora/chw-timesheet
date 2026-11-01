// SPEC §2: iPhone setup is blocked until the app runs from the Home Screen; Android is not.
import { expect, test } from '@playwright/test';
import { heading } from './helpers.js';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

test.describe('iPhone in Safari', () => {
  test.use({ userAgent: IPHONE });

  test('shows the install gate instead of setup', async ({ page }) => {
    await page.goto('./');
    await expect(heading(page, 'Add CHW Time Tracker to your Home Screen')).toBeVisible();
    await expect(page.getByText('Add to Home Screen', { exact: true })).toBeVisible();
    await expect(heading(page, 'Set up')).toHaveCount(0);
  });

  test('opened from the Home Screen goes to setup', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true });
    });
    await page.goto('./');
    await expect(heading(page, 'Set up')).toBeVisible();
  });
});

test.describe('Android', () => {
  test.use({ userAgent: ANDROID });

  test('is not blocked', async ({ page }) => {
    await page.goto('./');
    await expect(heading(page, 'Set up')).toBeVisible();
  });
});
