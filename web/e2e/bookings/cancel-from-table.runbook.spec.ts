// Runbook bookings.cancel-from-table (docs/runbooks/bookings/cancel-from-table.md). Change the runbook first, then /runbooks:to-test bookings.cancel-from-table.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const RUNBOOK = 'bookings.cancel-from-table';
const UPSTREAM = process.env.RUNBOOKS_UPSTREAM_URL;

// The tokens in web/src/app/globals.css, as the browser computes them.
const WHITE = 'rgb(255, 255, 255)';
const BAR_ACTIVE = 'rgb(29, 78, 216)'; // --color-bar-active #1D4ED8
const BAR_CANCELED = 'rgb(238, 240, 243)'; // --color-bar-canceled #EEF0F3
const BAR_CANCELED_BORDER = 'rgb(138, 145, 158)'; // --color-bar-canceled-border #8A919E
const MUTED_FG = 'rgb(86, 93, 107)'; // --muted-foreground #565D6B
const CHIP_CANCELED = { background: 'rgb(238, 240, 243)', color: 'rgb(58, 64, 76)' }; // --color-chip-canceled-*
const OK = { background: 'rgb(236, 247, 240)', border: 'rgb(167, 215, 184)', color: 'rgb(20, 83, 45)', chip: 'rgb(21, 128, 61)' }; // --color-ok-*
const LOG_OK = 'rgb(134, 239, 172)'; // --color-log-ok #86EFAC

const CANCEL_REPLY =
  '200 {"result":"canceled","booking":{"id":"A","resource":{"id":"R1","name":"Agora Room"},"start":10,"end":20,"status":"canceled"}}';

type Step = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'S11';

type Logged = { method: string; path: string; body: unknown; status: number };

async function select(request: APIRequestContext, step: Step) {
  const res = await request.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: RUNBOOK, mode: 'mocked', step } });
  expect(res.status()).toBe(200);
}

async function state(request: APIRequestContext) {
  const res = await request.get(`${UPSTREAM}/__runbooks/state`);
  const body = (await res.json()) as { requests: Logged[]; unmatched: unknown[] };
  return {
    requests: body.requests.map(({ method, path, body, status }) => ({ method, path, body, status })),
    unmatched: body.unmatched,
  };
}

const ui = (page: Page) => {
  const timeline = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Timeline' }) });
  const table = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Bookings', exact: true }) });
  const bars = (label: string) => timeline.getByText(label, { exact: true }).locator('..').locator('[title^="Booking "]');
  return {
    card: page.getByRole('region', { name: 'Operation', exact: true }).getByRole('status'),
    rows: page.getByRole('table').locator('tbody tr'),
    chip: (label: string) => table.getByRole('button', { name: new RegExp(`^${label} \\(\\d+\\)$`) }),
    cancel: (id: string) => page.getByRole('button', { name: `Cancel booking ${id}`, exact: true }),
    empty: page.getByText('No bookings in this filter.', { exact: true }),
    r1Bars: bars('R1 · Agora Room'),
    r2Bars: bars('R2 · Pixel Room'),
    entries: page.getByRole('region', { name: 'Operation log' }).getByRole('listitem'),
    dialog: page.getByRole('alertdialog'),
    // Exact names: the row trigger is "Cancel booking A".
    confirm: page.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking', exact: true }),
    keep: page.getByRole('alertdialog').getByRole('button', { name: 'Keep booking', exact: true }),
  };
};

// S10 and S11: the dialog closed, nothing was sent, and A is untouched.
async function expectNothingSent(page: Page, request: APIRequestContext) {
  const f = ui(page);
  await expect(f.dialog).toHaveCount(0);
  await expectActiveRow(f.rows.nth(0), 'A', 'R1 · Agora Room', '[10,20)');
  await expect(f.card).toHaveCount(0);
  await expect(f.entries).toHaveCount(0);
  expect(await state(request)).toEqual({ requests: [], unmatched: [] });
}

// The Status badge is the only element in its cell.
const badge = (row: Locator) => row.getByRole('cell').nth(3).locator(':scope > *');

async function expectChips(page: Page, all: number, active: number, canceled: number, pressed: 'All' | 'Active' | 'Canceled') {
  const f = ui(page);
  await expect(f.chip('All')).toHaveText(`All (${all})`);
  await expect(f.chip('Active')).toHaveText(`Active (${active})`);
  await expect(f.chip('Canceled')).toHaveText(`Canceled (${canceled})`);
  for (const label of ['All', 'Active', 'Canceled'] as const) {
    await expect(f.chip(label)).toHaveAttribute('aria-pressed', String(label === pressed));
  }
}

async function expectActiveRow(row: Locator, id: string, resource: string, interval: string) {
  await expect(row.getByRole('cell')).toHaveText([id, resource, interval, 'Active', 'Cancel']);
  const button = row.getByRole('button', { name: `Cancel booking ${id}`, exact: true });
  await expect(button).toHaveText('Cancel');
  await expect(button).toBeEnabled();
}

async function expectCanceledRowA(row: Locator) {
  await expect(row.getByRole('cell')).toHaveText(['A', 'R1 · Agora Room', '[10,20)', 'Canceled', '']);
  await expect(row.getByRole('button')).toHaveCount(0);
  await expect(badge(row)).toHaveCSS('background-color', CHIP_CANCELED.background);
  await expect(badge(row)).toHaveCSS('color', CHIP_CANCELED.color);
}

async function expectActiveBar(bar: Locator, text: string, title: string) {
  await expect(bar).toHaveText(text);
  await expect(bar).toHaveAttribute('title', title);
  await expect(bar).toHaveCSS('background-color', BAR_ACTIVE);
  await expect(bar).toHaveCSS('color', WHITE);
  await expect(bar).toHaveCSS('border-top-style', 'solid');
}

// The axis runs 0 to 100 for bookings ending at 40, so A [10,20) sits at left 10% with width 10%.
const A_POSITION = /left: 10%; width: 10%/;

// Clicks Cancel on A, confirms in the dialog and waits for the write to finish: the result card lands with the re-fetched list.
async function cancelA(page: Page) {
  const f = ui(page);
  await f.cancel('A').click();
  await f.confirm.click();
  await expect(f.card).toBeVisible();
  await expect(badge(f.rows.nth(0))).toHaveText('Canceled');
}

test.describe('Cancel an active booking from the Bookings table', () => {
  // The runbook never reloads the page: S02 cancels on the page S01 loaded, and S03 to S08 read the screen S02 left.
  // Each test loads `/` under S01, replays S02's cancel under S02 when it builds on it, then selects its own step.
  test.beforeEach(async ({ page, request }, info) => {
    expect(UPSTREAM, 'RUNBOOKS_UPSTREAM_URL names the upstream server').toBeTruthy();
    const step = /^(S\d+)/.exec(info.title)![1] as Step;
    await select(request, 'S01');
    await page.goto('/');
    await expect(ui(page).rows).toHaveCount(2);
    // Dev mode (React Strict Mode) loads the lists twice: let both answers land before S02's fixtures take over.
    await page.waitForLoadState('networkidle');
    if (step === 'S01') return;
    // S09 to S11 send no request: the runbook-level fixtures answer them.
    if (step === 'S09' || step === 'S10' || step === 'S11') {
      await select(request, step);
      if (step !== 'S11') await ui(page).cancel('A').click();
      return;
    }
    await select(request, 'S02');
    if (step === 'S02') return;
    await cancelA(page);
    await select(request, step);
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext();
    await api.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: null, mode: 'live' } });
    await api.dispose();
  });

  test('S01 Before the cancel, A is Active and offers Cancel', async ({ page }) => {
    const f = ui(page);

    await expectChips(page, 2, 2, 0, 'All');
    await expect(f.rows).toHaveCount(2);
    await expectActiveRow(f.rows.nth(0), 'A', 'R1 · Agora Room', '[10,20)');
    await expectActiveRow(f.rows.nth(1), 'B', 'R2 · Pixel Room', '[30,40)');

    await expect(f.r1Bars).toHaveCount(1);
    await expectActiveBar(f.r1Bars.first(), 'A [10,20)', 'Booking A · [10,20) · active');
    await expect(f.r1Bars.first()).toHaveAttribute('style', A_POSITION);

    await expect(f.card).toHaveCount(0);
    await expect(f.entries).toHaveCount(0);
  });

  test('S09 Pressing Cancel opens a confirmation dialog and sends nothing', async ({ page, request }) => {
    const f = ui(page);

    await expect(f.dialog).toBeVisible();
    await expect(f.dialog.getByRole('heading')).toHaveText('Cancel booking A?');
    await expect(f.dialog.getByText('R1 [10,20) becomes free. The id A stays taken.', { exact: true })).toBeVisible();
    await expect(f.dialog.getByRole('button')).toHaveText(['Keep booking', 'Cancel booking']);
    await expect(f.card).toHaveCount(0);
    await expect(f.entries).toHaveCount(0);
    expect(await state(request)).toEqual({ requests: [], unmatched: [] });
  });

  test('S10 Keep booking closes the dialog and sends nothing', async ({ page, request }) => {
    await ui(page).keep.click();
    await expectNothingSent(page, request);
  });

  test('S11 Escape closes the dialog and sends nothing', async ({ page, request }) => {
    const f = ui(page);
    await f.cancel('A').click();
    await expect(f.dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNothingSent(page, request);
  });

  test('S02 Confirming in the dialog sends the cancel for A, then re-fetches the list', async ({ page, request }) => {
    const f = ui(page);
    await f.cancel('A').click();
    await f.confirm.click();
    await expect(f.card).toBeVisible();
    await expect(f.dialog).toHaveCount(0);

    await expect
      .poll(async () => (await state(request)).requests)
      .toEqual([
        { method: 'POST', path: '/bookings/A/cancel', body: null, status: 200 },
        { method: 'GET', path: '/bookings', body: null, status: 200 },
      ]);
    expect((await state(request)).unmatched).toEqual([]);
  });

  test('S03 The result card says A was canceled and its id stays taken', async ({ page }) => {
    const { card } = ui(page);

    await expect(card).toHaveCount(1);
    const chip = card.getByText('canceled', { exact: true });
    await expect(chip).toBeVisible();
    await expect(card.getByText('Booking A canceled', { exact: true })).toBeVisible();
    await expect(card.locator('p')).toHaveText('Its id stays taken.');

    await expect(card).toHaveCSS('background-color', OK.background);
    await expect(card).toHaveCSS('border-top-color', OK.border);
    await expect(card).toHaveCSS('color', OK.color);
    await expect(chip).toHaveCSS('background-color', OK.chip);
  });

  test('S04 A\'s row turns Canceled and no longer offers Cancel', async ({ page }) => {
    const f = ui(page);

    await expect(f.rows).toHaveCount(2);
    await expectCanceledRowA(f.rows.nth(0));
    await expect(f.cancel('A')).toHaveCount(0);
    await expect(f.rows.nth(0)).toHaveCSS('opacity', '1');
    await expect(f.rows.nth(1).getByRole('cell').nth(0)).toHaveText('B');
  });

  test('S05 A\'s timeline bar turns Canceled', async ({ page }) => {
    const { r1Bars } = ui(page);

    await expect(r1Bars).toHaveCount(1);
    const bar = r1Bars.first();
    await expect(bar).toHaveText('A [10,20)');
    await expect(bar).toHaveAttribute('title', 'Booking A · [10,20) · canceled');
    await expect(bar).toHaveCSS('background-color', BAR_CANCELED);
    await expect(bar).toHaveCSS('border-top-style', 'dashed');
    await expect(bar).toHaveCSS('border-top-color', BAR_CANCELED_BORDER);
    await expect(bar).toHaveCSS('color', MUTED_FG);
    await expect(bar).toHaveCSS('text-decoration-line', 'line-through');
    await expect(bar).toHaveAttribute('style', A_POSITION);
  });

  test('S06 The Operation log records the cancel and the API\'s answer', async ({ page }) => {
    const { entries } = ui(page);

    await expect(entries).toHaveCount(1);
    const entry = entries.first();
    await expect(entry.locator('span').nth(0)).toHaveText('#1');
    await expect(entry.locator('span').nth(1)).toHaveText('POST /bookings/A/cancel');
    const reply = entry.locator(':scope > div').nth(1);
    await expect(reply).toHaveText(`→ ${CANCEL_REPLY}`);
    await expect(reply).toHaveCSS('color', LOG_OK);
    await expect(reply).toHaveCSS('padding-left', '28px');
  });

  test('S07 The filter chips count A as Canceled, and the Canceled filter shows it', async ({ page }) => {
    const f = ui(page);

    await expectChips(page, 2, 1, 1, 'All');
    await f.chip('Canceled').click();

    await expect(f.chip('Canceled')).toHaveText('Canceled (1)');
    await expect(f.chip('Canceled')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.rows).toHaveCount(1);
    await expectCanceledRowA(f.rows.first());
    await expect(f.empty).toHaveCount(0);
  });

  test('S08 The other booking is untouched', async ({ page }) => {
    const f = ui(page);

    await f.chip('Active').click();

    await expect(f.chip('Active')).toHaveText('Active (1)');
    await expect(f.chip('Active')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.rows).toHaveCount(1);
    await expectActiveRow(f.rows.first(), 'B', 'R2 · Pixel Room', '[30,40)');

    await expect(f.r2Bars).toHaveCount(1);
    await expectActiveBar(f.r2Bars.first(), 'B [30,40)', 'Booking B · [30,40) · active');
  });
});
