import { defineConfig, devices } from '@playwright/test';

// The ui runbook specs replay recorded API answers through the runbooks upstream server,
// so the web app must call that server instead of the API.
const UPSTREAM = (process.env.RUNBOOKS_UPSTREAM_URL ??= 'http://127.0.0.1:4010');

export default defineConfig({
  testDir: './e2e',
  // One upstream server holds the selected runbook and step: specs must not run in parallel.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run runbooks:upstream',
      cwd: '..',
      url: `${UPSTREAM}/__runbooks/state`,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev',
      env: { NEXT_PUBLIC_API_URL: UPSTREAM },
      url: 'http://localhost:3000',
      // A dev server already on :3000 may call the real API, so always start our own.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
