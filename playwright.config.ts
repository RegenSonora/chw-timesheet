import { defineConfig, devices } from '@playwright/test';

// Phone size from BUILD_PLAN M0. Tests run against the built dist/, served under the Pages path.
const phone = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

// E2E_PORT lets a second checkout run e2e while another serves 4173.
const port = Number(process.env['E2E_PORT'] ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}/chw-timesheet/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...phone } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...phone } },
  ],
  webServer: {
    command: `node scripts/serve-dist.mjs ${String(port)}`,
    url: `http://localhost:${String(port)}/chw-timesheet/`,
    reuseExistingServer: !process.env['CI'],
  },
});
