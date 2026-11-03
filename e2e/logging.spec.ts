// Setup → timer → entry → edit → delete/undo (BUILD_PLAN M3, SPEC §5).
import { expect, test } from '@playwright/test';
import {
  addEntry,
  heading,
  pickLine,
  pickTaskAndLine,
  setUpWithoutRole,
  taskBox,
  ZONE,
} from './helpers.js';

test.use({ timezoneId: ZONE });

test('setup checks the fields in plain words', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Initials').fill('C3');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await expect(page.getByText('Use 1 to 4 letters, like CC.')).toBeVisible();
  await expect(page.getByLabel('Initials')).toHaveAttribute('aria-invalid', 'true');
});

test('a half-filled setup survives a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Your name').fill('Carmen Cruz');
  await expect(page.getByLabel('Your name')).toHaveValue('Carmen Cruz');
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByLabel('Your name')).toHaveValue('Carmen Cruz');
});

test('timer → task → counts → save, then undo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-30T09:12:04-07:00') });
  await setUpWithoutRole(page);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^0:00:0\d$/);
  await expect(page.getByText('Started 9:12 AM, Fri, Oct 30')).toBeVisible();

  await page.clock.fastForward('01:25:06');
  await expect(page.getByRole('timer')).toHaveText(/^1:25:0\d$/);
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(page.getByText('Fri, Oct 30 · 9:12–10:37 AM')).toBeVisible();
  await expect(page.getByText('Rounded from 1 hr 25 min')).toBeVisible();
  await expect(page.getByText('1.5 hrs')).toBeVisible();

  // Next without picks: errors next to the fields.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Check what you did.')).toBeVisible();
  // One funding source: shown as a label, not a picker (decision 0028).
  await expect(page.getByText('Billed to: TISUPP', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^TISUPP (Choose|Change)$/ })).toHaveCount(0);
  await expect(page.getByText('Pick a budget line.')).toBeVisible();

  await pickTaskAndLine(page, 'Client check in', 'CHW referrals');
  await page.getByRole('button', { name: 'More contacts' }).click();
  await page.getByRole('button', { name: 'More referrals given' }).click();
  await page.getByRole('button', { name: '+ Add another count' }).click();
  await page.getByLabel('Count 1 name').fill('Food boxes');
  await page.getByRole('button', { name: 'More Food boxes' }).click();
  await expect(
    page.getByText("Don't include client names. Notes appear on the timesheet."),
  ).toBeVisible();
  await page.getByLabel('Notes (optional)').fill('Met at the library table');
  await page.getByRole('button', { name: 'Save entry' }).click();

  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
  await expect(page.getByText('1 entry · 1.5 hrs · $30.00')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Saved: 1.5 hrs, Client check in');
  await expect(page.getByRole('button', { name: /Client check in/ })).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status')).toContainText('Entry removed');
  await expect(page.getByText('Start timer and start working or record time.')).toBeVisible();
});

test('the next entry starts on the last budget line with recent tasks first', async ({ page }) => {
  await setUpWithoutRole(page);
  await addEntry(page, {
    date: '2026-10-29',
    start: '13:15',
    end: '15:00',
    task: 'Client follow up',
  });
  await page.getByRole('button', { name: 'Record time' }).click();
  await page.getByLabel('Date').fill('2026-10-30');
  await page.getByLabel('Start').fill('09:00');
  await page.getByLabel('End').fill('10:00');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'CHW referrals Change' })).toBeVisible();
  await expect(page.getByText('Recent')).toBeVisible();
  await expect(page.getByRole('checkbox').first()).toHaveAccessibleName(/^Client follow up/);
});

test('split one entry between two tasks (decision 0024)', async ({ page }) => {
  await setUpWithoutRole(page);
  await page.getByRole('button', { name: 'Record time' }).click();
  await page.getByLabel('Date').fill('2026-10-30');
  await page.getByLabel('Start').fill('09:12');
  await page.getByLabel('End').fill('10:37');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(heading(page, 'What did you do?')).toBeVisible();
  await taskBox(page, 'Client check in').check();
  await taskBox(page, 'Outreach').check();
  await pickLine(page, 'CHW referrals');
  await expect(page.getByText('Step 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(heading(page, 'Split your time')).toBeVisible();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  // The first task checked starts with all the hours.
  await expect(page.getByText('All 1.5 hrs assigned')).toBeVisible();
  await page.getByRole('button', { name: 'More time on Outreach' }).click();
  await expect(page.getByText('0.25 hrs too many')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Split all the hours between your tasks.')).toBeVisible();
  await expect(heading(page, 'Split your time')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Less time on Client check in' }).click();
  }
  // Client check in 0.75 h, Outreach 0.25 h.
  await expect(page.getByText('1.5 hrs logged · 0.5 hrs left')).toBeVisible();
  await page.getByRole('button', { name: 'More time on Outreach' }).click();
  await expect(page.getByText('1.5 hrs logged · 0.25 hrs left')).toBeVisible();
  await page.getByRole('button', { name: 'More time on Outreach' }).click();
  await expect(page.getByText('All 1.5 hrs assigned')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(heading(page, 'Counts and notes')).toBeVisible();
  await expect(page.getByText('Step 3 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('status')).toContainText('Saved: 1.5 hrs, Client check in + 1 more');
  await expect(page.getByText('1 entry · 1.5 hrs · $30.00')).toBeVisible();

  // Edit: a new end time un-matches the split, so Save asks for it again.
  await page.getByRole('button', { name: /Client check in \+ 1 more/ }).click();
  await expect(heading(page, 'Edit entry')).toBeVisible();
  await expect(page.getByText('All 1.5 hrs assigned')).toBeVisible();
  await page.getByLabel('End').fill('10:52');
  await expect(page.getByText('1.75 hrs logged · 0.25 hrs left')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Split all the hours between your tasks.')).toBeVisible();
  await page.getByRole('button', { name: 'More time on Client check in' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Saved: 1.75 hrs, Client check in + 1 more');

  // Unchecking down to one task gives it all the hours.
  await page.getByRole('button', { name: /Client check in \+ 1 more/ }).click();
  await expect(heading(page, 'Edit entry')).toBeVisible();
  await page.getByRole('button', { name: 'Client check in + 1 more Change' }).click();
  await taskBox(page, 'Outreach').uncheck();
  await page.getByRole('button', { name: 'Done with tasks' }).click();
  await expect(page.getByText(/assigned|h left|too many/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Saved: 1.75 hrs, Client check in');
});

test('edit an entry, move it to another source, delete and undo', async ({ page }) => {
  await setUpWithoutRole(page, { regen: true });
  await addEntry(page, { date: '2026-10-30', start: '09:12', end: '10:37' });

  await page.getByRole('button', { name: /Client check in/ }).click();
  await expect(heading(page, 'Edit entry')).toBeVisible();
  await page.getByRole('button', { name: 'CHW referrals Change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Outreach and marketing' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Saved: 1.5 hrs, Client check in');
  await expect(page.getByText('9:12–10:37 AM · Outreach and marketing')).toBeVisible();

  // Decision 0008: move to Regen General Operating; picks it also has carry over.
  await page.getByRole('button', { name: /Client check in/ }).click();
  await page.getByRole('button', { name: 'TISUPP Change' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^REGEN-GO/ })
    .click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Moved to REGEN-GO');
  await expect(page.getByRole('button', { name: /Funding source REGEN-GO/ })).toBeVisible();
  await expect(page.getByText('1 entry · 1.5 hrs · $27.00')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /Funding source TISUPP/ })).toBeVisible();
  await expect(page.getByText('1 entry · 1.5 hrs · $30.00')).toBeVisible();

  await page.getByRole('button', { name: /Client check in/ }).click();
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete entry' }).click();
  await expect(page.getByRole('status')).toContainText('Deleted: 1.5 hrs, Client check in');
  await expect(page.getByText('Start timer and start working or record time.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('1 entry · 1.5 hrs · $30.00')).toBeVisible();
});

test('leaving an edit with changes asks first', async ({ page }) => {
  await setUpWithoutRole(page);
  await addEntry(page, { date: '2026-10-30', start: '09:12', end: '10:37' });
  await page.getByRole('button', { name: /Client check in/ }).click();
  await page.getByLabel('Notes (optional)').fill('Changed');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Discard your changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(heading(page, 'Edit entry')).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(heading(page, 'Regen Time Tracking')).toBeVisible();
});

test('All entries lists every uninvoiced entry for the chip source', async ({ page }) => {
  await setUpWithoutRole(page);
  for (const [date, start, end] of [
    ['2026-10-26', '09:00', '10:00'],
    ['2026-10-27', '09:00', '10:00'],
    ['2026-10-28', '09:00', '10:00'],
    ['2026-10-29', '09:00', '10:00'],
  ] as const) {
    await addEntry(page, { date, start, end });
  }
  await expect(page.getByRole('list').getByRole('button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Show all 4 entries' }).click();
  await expect(heading(page, 'TISUPP entries')).toBeVisible();
  await expect(page.getByRole('button', { name: /Client check in/ })).toHaveCount(4);
  await expect(page.getByText('4 entries · 4 hrs · $80.00')).toBeVisible();
});
