// Shared steps for the e2e tests: a fresh phone, setup, entries and axe checks.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Arizona: no daylight saving, so labels are stable (CLAUDE.md data conventions). */
export const ZONE = 'America/Phoenix';

/** Run axe with WCAG 2.1 A and AA rules; fail on any violation. */
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    where,
  ).toEqual([]);
}

export function heading(page: Page, name: string | RegExp) {
  return page.getByRole('heading', { level: 1, name });
}

/** Fill in setup with TISUPP at $20.00 (and REGEN-GO at $18.00 when asked). */
export async function setUp(page: Page, options: { regen?: boolean } = {}): Promise<void> {
  await page.goto('./');
  await expect(heading(page, 'Set up')).toBeVisible();
  await page.getByLabel('Your name').fill('Carmen Cruz');
  await page.getByLabel('Initials').fill('cc');
  if (options.regen) {
    await page.getByRole('checkbox', { name: /REGEN-GO/ }).check();
    await page.getByLabel('Hourly rate for REGEN-GO').fill('18.00');
  }
  await page.getByRole('button', { name: 'Save and start' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
}

/** Enter times → task and budget line → Save, from Home. */
export async function addEntry(
  page: Page,
  entry: {
    date: string;
    start: string;
    end: string;
    task?: string;
    line?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: 'Enter times instead' }).click();
  await expect(heading(page, 'Enter times')).toBeVisible();
  // In WebKit a fill right after the screen mounts sometimes fires no input event, and the
  // field shows today's date again. Fill until all three values stick.
  await expect(async () => {
    await page.getByLabel('Date').fill(entry.date);
    await page.getByLabel('Start').fill(entry.start);
    await page.getByLabel('End').fill(entry.end);
    await expect(page.getByLabel('Date')).toHaveValue(entry.date, { timeout: 500 });
    await expect(page.getByLabel('Start')).toHaveValue(entry.start, { timeout: 500 });
    await expect(page.getByLabel('End')).toHaveValue(entry.end, { timeout: 500 });
  }).toPass();
  await page.getByRole('button', { name: 'Next' }).click();
  await pickTaskAndLine(page, entry.task ?? 'Client check in', entry.line ?? 'CHW referrals');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'CHW Time Tracker')).toBeVisible();
}

export async function pickTaskAndLine(page: Page, task: string, line: string): Promise<void> {
  await expect(heading(page, 'New entry')).toBeVisible();
  await page
    .getByRole('button', { name: /^(Not picked yet|.+) (Choose|Change)$/ })
    .nth(1)
    .click();
  await page.getByRole('dialog').getByRole('button', { name: line, exact: true }).click();
  await page.getByRole('radio', { name: new RegExp(`^${task}`) }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
}
