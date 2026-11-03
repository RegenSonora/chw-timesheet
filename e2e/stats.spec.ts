// My stats, Generate under Past invoices, and the Work Hours Report (decision 0026).
import { expect, test, type Page } from '@playwright/test';
import { readPdf } from '../tests/files/pdf-reader.js';
import {
  addEntry,
  expectAccessible,
  heading,
  parseCsv,
  readPng,
  setUp,
  sharedFiles,
  stubShare,
  ZONE,
} from './helpers.js';

test.use({ timezoneId: ZONE });

/** One row of My stats by its label, e.g. "Hours invoiced". */
const stat = (page: Page, label: string | RegExp) =>
  page.locator('.stat').filter({ has: page.locator('dt', { hasText: label }) });

/**
 * Put an invoice of `quarters` straight into the phone's database, as months of earlier invoices
 * would have, then reload. Its entries carry core competencies for the report.
 */
async function seedInvoice(page: Page, quarters: number) {
  await page.evaluate(async (q) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('chw-gila-river-contractors');
      req.onsuccess = () => {
        resolve(req.result);
      };
      req.onerror = () => {
        reject(req.error ?? new Error('open failed'));
      };
    });
    const counts = {
      contacts: 0,
      referrals_given: 0,
      referral_followups: 0,
      rides_provided: 0,
      applications_completed: 0,
      other: [],
    };
    const entry = (n: number, date: string, task: [string, string, string], quarters: number) => ({
      id: `seed-${String(n)}`,
      start: `${date}T09:00:00-07:00`,
      stop: `${date}T09:00:00-07:00`,
      entry_date: date,
      quarters,
      tasks: [{ task_id: task[0], task_name: task[1], core_competency: task[2], quarters }],
      budget_line_id: 'chw-experience-hours',
      budget_line_name: 'CHW experience hours',
      counts,
      notes: '',
      created_at: `${date}T09:00:00-07:00`,
      updated_at: `${date}T09:00:00-07:00`,
    });
    const half = Math.floor(q / 2);
    const entries = [
      entry(1, '2026-09-14', ['outreach', 'Outreach', 'Outreach'], half),
      entry(2, '2026-09-21', ['advocacy', 'Advocacy', 'Advocacy'], q - half),
    ];
    const invoice = {
      id: 'seed-invoice',
      number: 'CC-2026-090',
      sequence: 90,
      source: {
        id: 'tisupp',
        code: 'TISUPP',
        name: 'Trauma-Informed Substance Use Prevention Program',
        version: 4,
        certification_text: '',
      },
      chw: { name: 'Carmen Cruz', initials: 'CC', mailing_address: '' },
      invoice_date: '2026-09-30',
      period_start: '2026-09-14',
      period_end: '2026-09-21',
      rate_cents: 2000,
      entries,
      lines: [],
      total_quarters: q,
      total_cents: q * 500,
      counts_period: counts,
      counts_all_time: counts,
      nte: { state: 'none' },
      canonical_version: 2,
      fingerprint: '0'.repeat(64),
      created_at: '2026-09-30T16:00:00-07:00',
      updated_at: '2026-09-30T16:00:00-07:00',
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['invoices'], 'readwrite');
      tx.objectStore('invoices').put(invoice);
      tx.oncomplete = () => {
        resolve();
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('write failed'));
      };
    });
    db.close();
  }, quarters);
  await page.reload();
  await expect(heading(page, 'CHW Gila River Contractors')).toBeVisible();
}

test('My stats counts invoiced hours; Generate sits under Past invoices', async ({ page }) => {
  test.setTimeout(90_000);
  await setUp(page);
  await expect(stat(page, 'Hours invoiced')).toContainText('0 hrs');
  await expect(stat(page, 'Hrs needed for pay increase')).toContainText('to $23.00/hr');
  await expect(stat(page, 'Hrs needed for pay increase')).toContainText('240 hrs');
  await expect(stat(page, 'Hrs needed for CHW Cert eligibility')).toContainText('480 hrs');
  await expect(page.getByText('Counts invoices made on this phone.')).toBeVisible();

  await addEntry(page, { date: '2026-10-30', start: '09:00', end: '11:00' });
  // Waiting hours are shown but don't move the goals.
  await expect(stat(page, 'Hours invoiced')).toContainText('+ 2 hrs not yet invoiced');
  await expect(stat(page, 'Hrs needed for pay increase')).toContainText('240 hrs');

  // Generate: a row under Past invoices, the same height, light green with dark gold text.
  const past = page.getByRole('button', { name: /Past invoices/ });
  const generate = page.getByRole('button', { name: 'Generate Regen Invoice' });
  const [p, g] = [await past.boundingBox(), await generate.boundingBox()];
  expect(g && p && g.y > p.y).toBe(true);
  expect(Math.round(g?.height ?? 0)).toBe(Math.round(p?.height ?? 0));
  await expect(generate).toHaveCSS('background-color', 'rgb(220, 239, 208)');
  await expect(generate).toHaveCSS('color', 'rgb(122, 88, 0)');
  await expectAccessible(page, 'home with my stats');

  await generate.click();
  await page.getByRole('button', { name: 'Create invoice files' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done anyway' }).click();
  await expect(stat(page, 'Hours invoiced')).toContainText('2 hrs');
  await expect(stat(page, 'Hrs needed for pay increase')).toContainText('238 hrs');
  await expect(stat(page, 'Hrs needed for CHW Cert eligibility')).toContainText('478 hrs');
});

test('at 240 hours the raise is reached until the rate changes', async ({ page }) => {
  await setUp(page);
  await seedInvoice(page, 960);
  await expect(stat(page, 'Pay increase')).toContainText(
    'Reached. Change your rate to $23.00 in Settings.',
  );
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Hourly rate for TISUPP').fill('23.00');
  // No entries are waiting, so the new rate saves without asking (SPEC §4).
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(heading(page, 'CHW Gila River Contractors')).toBeVisible();
  await expect(stat(page, /pay increase/i)).toHaveCount(0);
  await expect(stat(page, 'Hrs needed for CHW Cert eligibility')).toContainText('240 hrs');
});

test('at 480 hours, Eligible opens the Work Hours Report, which shares PDF, PNG and CSV', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-02T09:00:00-07:00') });
  await stubShare(page);
  await setUp(page);
  await seedInvoice(page, 1946);
  await expect(stat(page, 'Hours invoiced')).toContainText('486.5 hrs');
  const cert = stat(page, 'CHW Cert eligibility');
  await expect(cert).toContainText('Press "Eligible" to generate your Work Hours Report');
  await expectAccessible(page, 'home, eligible');
  await cert.getByRole('button', { name: 'Eligible' }).click();

  await expect(heading(page, 'Work Hours Report')).toBeVisible();
  await expect(page.getByText('486.5 hrs worked')).toBeVisible();
  await expect(page.getByRole('row', { name: /^Outreach 09\/14\/2026 243\.25$/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /^Capacity-Building 0$/ })).toBeVisible();
  await expectAccessible(page, 'work hours report');

  await page.getByRole('button', { name: 'Share report' }).click();
  await expect(page.getByRole('status')).toHaveText('Report shared.');
  const [files] = await sharedFiles(page);
  expect(files?.map((f) => [f.name, f.type])).toEqual([
    ['TISUPP_Work_Hours_Report_2026-11-02.pdf', 'application/pdf'],
    ['TISUPP_Work_Hours_Report_2026-11-02.png', 'image/png'],
    ['TISUPP_Work_Hours_Report_2026-11-02.csv', 'text/csv'],
  ]);
  const pdf = await readPdf(new Uint8Array(files?.[0]?.bytes ?? []));
  expect(pdf[0]?.text).toContain('Outreach 243.25 09/14/2026');
  expect(pdf[0]?.text).toContain('Total 486.50');
  const png = await readPng(page, files?.[1]?.bytes ?? []);
  expect([png.width, png.height]).toEqual([1700, 2200]);
  const csv = parseCsv(files?.[2]?.bytes ?? []);
  expect(csv).toContainEqual(['Advocacy', '243.25', '09/21/2026']);
  expect(csv).toContainEqual(['Total', '486.50', '']);
});

test('the Work Hours Report runs from Settings at any time', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Work Hours Report/ }).click();
  await expect(heading(page, 'Work Hours Report')).toBeVisible();
  await expect(page.getByText('0 hrs worked')).toBeVisible();
  await expect(page.getByRole('row', { name: /^Knowledge Base 0$/ })).toBeVisible();
});
