// Roles on screen (roles plan R4; decisions 0027, 0028, 0029, 0031, 0032, 0033).
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, heading, setUp, taskBox, ZONE } from './helpers.js';

test.use({ timezoneId: ZONE });

/** Record time from Home and land on "What did you do?". */
async function recordTime(page: Page, date: string, start: string, end: string) {
  await page.getByRole('button', { name: 'Record time' }).click();
  await expect(heading(page, 'Enter times')).toBeVisible();
  await expect(async () => {
    await page.getByLabel('Date').fill(date);
    await page.getByLabel('Start').fill(start);
    await page.getByLabel('End').fill(end);
    await expect(page.getByLabel('Date')).toHaveValue(date, { timeout: 500 });
    await expect(page.getByLabel('End')).toHaveValue(end, { timeout: 500 });
  }).toPass();
}

test('setup picks a role, reviews it with the rate prefilled, and can pick again', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-03T09:00:00-07:00') });
  await page.goto('./');
  await page.getByLabel('Your name').fill('Carmen Cruz');
  await page.getByLabel('Initials').fill('cc');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(heading(page, 'Pick your role')).toBeVisible();
  await expectAccessible(page, 'pick your role');
  for (const code of ['CHW-TC01', 'CHW-TE01', 'R-TL01']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${code}`) })).toBeVisible();
  }

  await page.getByRole('button', { name: /^CHW-TC01/ }).click();
  await expect(heading(page, 'Your role')).toBeVisible();
  await expect(page.getByText('CHW-TC01 · CHW Trainee (Contractor)')).toBeVisible();
  await expect(page.getByRole('heading', { name: /TISUPP/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CHW experience hours' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: /^Outreach$/ })).toBeVisible();
  await expect(page.getByLabel('Hourly rate for TISUPP')).toHaveValue('20.00');
  await expect(page.getByText('It goes up to $23.00 after 240 hours.')).toBeVisible();
  await expectAccessible(page, 'review role');

  // A wrong pick is fixed before setup ends (decision 0027).
  await page.getByRole('button', { name: 'Pick a different role' }).click();
  await page.getByRole('button', { name: /^R-TL01/ }).click();
  await expect(page.getByText('R-TL01 · Resilience Team Lead')).toBeVisible();
  await expect(page.getByLabel('Hourly rate for REGEN-GO')).toHaveValue('22.00');
  // The app shows a budget line's display name (decision 0028).
  await expect(page.getByRole('heading', { name: 'Other', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fire risk reduction work' })).toBeVisible();

  // Back walks the steps, and the details are kept.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(heading(page, 'Pick your role')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(heading(page, 'Set up')).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveValue('Carmen Cruz');

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /^R-TL01/ }).click();
  await page.getByRole('button', { name: 'This is my role' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();

  // Settings shows the role read-only, with no way to add a source and no CHW report (0032).
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('R-TL01 · Resilience Team Lead')).toBeVisible();
  await expect(page.getByText('Set at setup. Ask the office to change it.')).toBeVisible();
  await expect(page.getByLabel('Hourly rate for REGEN-GO')).toHaveValue('22.00');
  await expect(page.getByText('Add a funding source')).toHaveCount(0);
  await expect(page.getByText('Work Hours Report')).toHaveCount(0);
  await expectAccessible(page, 'settings with a role');
});

test("a Team Lead entry: the role's lines, tasks and counts with units", async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T09:00:00-07:00') });
  await setUp(page, 'R-TL01');
  await recordTime(page, '2026-11-02', '09:00', '10:00');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'What did you do?')).toBeVisible();
  await expect(page.getByText('Billed to: REGEN-GO')).toBeVisible();
  await expect(page.getByText('Pick a budget line to see its tasks.')).toBeVisible();

  await page
    .locator('.field', { has: page.getByText('Budget line', { exact: true }) })
    .getByRole('button')
    .click();
  const lines = page.getByRole('dialog').getByRole('button');
  await expect(lines.filter({ hasText: 'Other' })).toHaveCount(1);
  await expect(lines.filter({ hasText: 'CHW referrals' })).toHaveCount(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Resilient Home Services contracting', exact: true })
    .click();
  await expect(taskBox(page, 'Water harvesting')).toBeVisible();
  await expect(taskBox(page, 'Dump runs')).toHaveCount(0);
  await taskBox(page, 'Water harvesting').check();
  await expectAccessible(page, 'role task step');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(heading(page, 'Counts and notes')).toBeVisible();
  await expect(page.getByText('Water capacity added')).toBeVisible();
  await expect(page.getByText('Trees planted')).toHaveCount(0);
  await expect(page.getByText('Contacts')).toHaveCount(0);
  await page.getByRole('button', { name: 'More water capacity added' }).click();
  await expect(page.getByText('1 gal')).toBeVisible();

  // "Add another count" points to a count the entry already has (decision 0029).
  await page.getByRole('button', { name: '+ Add another count' }).click();
  await page.getByLabel('Count 1 name').fill('water CAPACITY added');
  await expect(
    page.getByText('Water capacity added is already a count above. Use that one.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'Counts and notes')).toBeVisible();
  await expect(
    page.getByText('One extra count repeats a count above. Use that one, or remove it.'),
  ).toBeVisible();
  await expectAccessible(page, 'duplicate count');
  await page.getByLabel('Count 1 name').fill('Rain barrels');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
  await expect(page.getByRole('button', { name: /Water harvesting/ })).toBeVisible();
});

test('a CHW Trainee entry is billed to the one line, with its tasks counts', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T09:00:00-07:00') });
  await setUp(page);
  await recordTime(page, '2026-11-02', '09:00', '10:00');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Billed to: TISUPP · CHW experience hours')).toBeVisible();
  await taskBox(page, 'Outreach').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'Counts and notes')).toBeVisible();
  await expect(page.getByText('Contacts')).toBeVisible();
  await expect(page.getByText('Rides provided')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Regen Invoice' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not yet invoiced' })).toBeVisible();
});

test('an employee submits timesheets', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T09:00:00-07:00') });
  await setUp(page, 'CHW-TE01');
  await expect(page.getByRole('heading', { name: 'Not yet submitted' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Past timesheets/ })).toBeVisible();

  await recordTime(page, '2026-11-02', '09:00', '10:00');
  await page.getByRole('button', { name: 'Next' }).click();
  await taskBox(page, 'Outreach').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('button', { name: 'Submit timesheet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Regen Invoice' })).toHaveCount(0);
  await expectAccessible(page, 'employee home');

  await page.getByRole('button', { name: /Past timesheets/ }).click();
  await expect(heading(page, 'Past timesheets')).toBeVisible();
  await expect(page.getByText('No timesheets yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // No NTE for employees (decision 0031); the CHW report stays (decision 0032).
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('CHW-TE01 · CHW Trainee (Employee)')).toBeVisible();
  await expect(page.getByLabel(/Not-to-exceed/)).toHaveCount(0);
  await expect(page.getByLabel(/Next invoice number/)).toBeVisible();
  await expect(page.getByText('Work Hours Report')).toBeVisible();
});

test('after every source ends, only time dated inside a period can be recorded', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2027-10-02T09:00:00-07:00') });
  await setUp(page);
  await expect(page.getByText('No active funding for your role. Ask the office.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start timer' })).toHaveCount(0);

  await recordTime(page, '2027-10-01', '09:00', '10:00');
  await expect(
    page.getByText('None of your funding takes time on this date. Ask the office.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

  await page.getByLabel('Date').fill('2027-09-30');
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next' }).click();
  await taskBox(page, 'Outreach').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Regen Invoice' })).toBeVisible();
});
