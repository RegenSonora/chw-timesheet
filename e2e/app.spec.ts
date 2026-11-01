// The page itself: CSP, no outside requests, service worker (CLAUDE.md rules 1–2).
import { expect, test } from '@playwright/test';
import { heading } from './helpers.js';

test('loads with no CSP violations or outside requests', async ({ page }) => {
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
  await expect(heading(page, 'Set up')).toBeVisible();

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

test('registers the service worker', async ({ page, browserName }) => {
  await page.goto('./');
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(scope, browserName).toMatch(/\/chw-timesheet\/$/);
});
