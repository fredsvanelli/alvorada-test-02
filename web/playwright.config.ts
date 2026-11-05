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
  // Each server signals readiness through stdout, not `url`: with `url`, Playwright connects
  // before starting the server, and on WSL2 mirrored networking a closed 127.0.0.1 port drops
  // the connection, so each check blocks for about 2m15s until ETIMEDOUT.
  // Both commands exit with an error when their port is taken, so a server already on :3000
  // (which may call the real API) fails the run.
  webServer: [
    {
      command: 'npm run runbooks:upstream',
      cwd: '..',
      wait: { stdout: /listening on/ },
    },
    {
      command: 'npm run dev -- -p 3000',
      env: { NEXT_PUBLIC_API_URL: UPSTREAM },
      wait: { stdout: /Ready in/ },
      timeout: 120_000,
    },
  ],
});
