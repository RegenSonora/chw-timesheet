import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('shows the placeholder with no CSP violations or outside requests', async ({ page }) => {
      const outside: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol !== 'data:') {
          outside.push(request.url());
        }
      });
      await page.addInitScript(() => {
        const store = window as unknown as { cspViolations: string[] };
        store.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          store.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
        });
      });

      await page.goto('./');

      await expect(page.getByRole('heading', { level: 1, name: 'CHW Time Tracker' })).toBeVisible();
      await expect(page.getByText(/^Version \d+\.\d+\.\d+\+\w+$/)).toBeVisible();

      const csp = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute('content');
      expect(csp).toContain("connect-src 'none'");

      const violations = await page.evaluate(
        () => (window as unknown as { cspViolations: string[] }).cspViolations,
      );
      expect(violations).toEqual([]);
      expect(outside).toEqual([]);
    });

    test('meets WCAG 2.1 AA (axe)', async ({ page }) => {
      await page.goto('./');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test('registers the service worker', async ({ page, browserName }) => {
  await page.goto('./');
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope, browserName).toMatch(/\/chw-timesheet\/$/);
});
