// Runbook bookings.cancel-from-timeline (docs/runbooks/bookings/cancel-from-timeline.md). Change the runbook first, then /runbooks:to-test bookings.cancel-from-timeline.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { LOG_GREEN, expectEntry, logEntries } from './operation-log';

const RUNBOOK = 'bookings.cancel-from-timeline';
const UPSTREAM = process.env.RUNBOOKS_UPSTREAM_URL;

// The tokens in web/src/app/globals.css, as the browser computes them.
const WHITE = 'rgb(255, 255, 255)';
const BAR_ACTIVE = 'rgb(29, 78, 216)'; // --color-bar-active #1D4ED8
const BAR_CANCELED = 'rgb(238, 240, 243)'; // --color-bar-canceled #EEF0F3
const BAR_CANCELED_BORDER = 'rgb(138, 145, 158)'; // --color-bar-canceled-border #8A919E
const MUTED_FG = 'rgb(86, 93, 107)'; // --muted-foreground #565D6B
const BORDER = 'rgb(221, 225, 231)'; // --border #DDE1E7
const DESTRUCTIVE = 'rgb(185, 28, 28)'; // --destructive #B91C1C
const CHIP_CANCELED = { background: 'rgb(238, 240, 243)', color: 'rgb(58, 64, 76)' }; // --color-chip-canceled-*
const OK = { background: 'rgb(236, 247, 240)', border: 'rgb(167, 215, 184)', color: 'rgb(20, 83, 45)', chip: 'rgb(21, 128, 61)' }; // --color-ok-*

// 1px border plus 8px padding (px-2) between the bar's right edge and its content.
const INSET = 9;

const CANCEL_REPLY = {
  result: 'canceled',
  booking: { id: 'A', resource: { id: 'R1', name: 'Agora Room' }, start: 10, end: 20, status: 'canceled' },
};

type Step = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'S11' | 'S12';

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

const xName = (id: string) => `Cancel booking ${id} from the Timeline`;

const ui = (page: Page) => {
  const timeline = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Timeline' }) });
  const table = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Bookings', exact: true }) });
  const bars = (label: string) => timeline.getByText(label, { exact: true }).locator('..').locator('[title^="Booking "]');
  return {
    heading: page.getByRole('heading', { name: 'Timeline', exact: true }),
    // includeHidden: an open dialog marks the rest of the page aria-hidden, and the card must still be found then.
    card: page.getByRole('region', { name: 'Operation', exact: true, includeHidden: true }).getByRole('status', { includeHidden: true }),
    rows: page.getByRole('table', { includeHidden: true }).locator('tbody tr'),
    chip: (label: string) => table.getByRole('button', { name: new RegExp(`^${label} \\(\\d+\\)$`) }),
    // Exact names: the table's row trigger is "Cancel booking A", the Timeline's is "Cancel booking A from the Timeline".
    rowCancel: (id: string) => page.getByRole('button', { name: `Cancel booking ${id}`, exact: true }),
    x: (id: string) => page.getByRole('button', { name: xName(id), exact: true }),
    r1Bars: bars('R1 · Agora Room'),
    r2Bars: bars('R2 · Pixel Room'),
    r3Bars: bars('R3 · 4K Projector'),
    entries: logEntries(page),
    dialog: page.getByRole('alertdialog'),
    confirm: page.getByRole('alertdialog').getByRole('button', { name: 'Cancel booking', exact: true }),
    keep: page.getByRole('alertdialog').getByRole('button', { name: 'Keep booking', exact: true }),
  };
};

const label = (bar: Locator) => bar.locator('span.truncate').first();
const track = (bar: Locator) => bar.locator('..');
// The bar's (x), found even while it has display: none.
const hiddenX = (bar: Locator, id: string) => bar.getByRole('button', { name: xName(id), exact: true, includeHidden: true });

async function box(l: Locator) {
  const b = await l.boundingBox();
  expect(b, 'element has a box').not.toBeNull();
  return { left: b!.x, top: b!.y, right: b!.x + b!.width, bottom: b!.y + b!.height, width: b!.width, height: b!.height };
}

// scrollWidth minus clientWidth: above 0 when the label is cut.
const overflow = (l: Locator) => l.evaluate((e) => e.scrollWidth - e.clientWidth);

// A computed color as RGBA bytes, painted on a canvas so any CSS color syntax (rgb, oklab, color-mix) compares.
const rgba = (l: Locator, prop: string) =>
  l.evaluate((e, p) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = getComputedStyle(e).getPropertyValue(p);
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  }, prop);

// "Hover a bar": the pointer rests on the bar's label, near its left end, away from where the (x) appears.
const hover = (bar: Locator) => label(bar).hover({ position: { x: 4, y: 4 } });

// "Move the pointer off": the pointer rests on the "Timeline" heading, outside every bar.
const moveOff = (page: Page) => ui(page).heading.hover();

// Bar A at left 10%, width 10% of its track, read from the style and from the boxes.
async function expectAtTenPercent(bar: Locator) {
  await expect(bar).toHaveAttribute('style', /left: 10%; width: 10%/);
  await expect
    .poll(async () => {
      const [b, t] = [await box(bar), await box(track(bar))];
      // Sub-pixel layout: within half a pixel of 10%.
      return Math.max(Math.abs(b.left - t.left - t.width / 10), Math.abs(b.width - t.width / 10));
    })
    .toBeLessThanOrEqual(0.5);
}

// At rest the label is cut with an ellipsis and fills the content box: its right edge is 9px left of the bar's.
async function expectTruncatedAtRest(bar: Locator) {
  const l = label(bar);
  await expect(l).toHaveCSS('text-overflow', 'ellipsis');
  await expect.poll(() => overflow(l)).toBeGreaterThan(0);
  await expect.poll(async () => Math.round((await box(bar)).right - (await box(l)).right)).toBe(INSET);
}

async function expectActiveBar(bar: Locator, text: string, title: string) {
  await expect(bar).toHaveText(text);
  await expect(bar).toHaveAttribute('title', title);
  await expect(bar).toHaveCSS('background-color', BAR_ACTIVE);
  await expect(bar).toHaveCSS('color', WHITE);
  await expect(bar).toHaveCSS('border-top-style', 'solid');
}

async function expectCanceledBar(bar: Locator, text: string, title: string) {
  await expect(bar).toHaveText(text);
  await expect(bar).toHaveAttribute('title', title);
  await expect(bar).toHaveCSS('background-color', BAR_CANCELED);
  await expect(bar).toHaveCSS('border-top-style', 'dashed');
  await expect(bar).toHaveCSS('border-top-color', BAR_CANCELED_BORDER);
  await expect(bar).toHaveCSS('color', MUTED_FG);
  await expect(bar).toHaveCSS('text-decoration-line', 'line-through');
}

// The Status badge is the only element in its cell.
const badge = (row: Locator) => row.getByRole('cell').nth(3).locator(':scope > *');

async function expectActiveRow(row: Locator, id: string, resource: string, interval: string) {
  await expect(row.getByRole('cell')).toHaveText([id, resource, interval, 'Active', 'Cancel']);
  const button = row.getByRole('button', { name: `Cancel booking ${id}`, exact: true });
  await expect(button).toHaveText('Cancel');
  await expect(button).toBeEnabled();
}

// S05 and S06: the dialog closed, nothing was sent, and A is untouched on the Timeline and in the table.
async function expectNothingSent(page: Page, request: APIRequestContext) {
  const f = ui(page);
  await expect(f.dialog).toHaveCount(0);
  expect(await state(request)).toEqual({ requests: [], unmatched: [] });
  await expectActiveBar(f.r1Bars.first(), 'A [10,20)', 'Booking A · [10,20) · active');
  await expectActiveRow(f.rows.nth(0), 'A', 'R1 · Agora Room', '[10,20)');
  await expect(f.card).toHaveCount(0);
  await expect(f.entries).toHaveCount(0);
}

// Hovers bar A and clicks its (x): the dialog opens.
async function openFromTimeline(page: Page) {
  const f = ui(page);
  await hover(f.r1Bars.first());
  await expect(f.x('A')).toBeVisible();
  await f.x('A').click();
  await expect(f.dialog).toBeVisible();
}

// Opens the dialog from bar A, confirms, and waits for the write to finish: the result card lands with the re-fetched list.
async function cancelA(page: Page) {
  const f = ui(page);
  await openFromTimeline(page);
  await f.confirm.click();
  await expect(f.card).toBeVisible();
  await expect(badge(f.rows.nth(0))).toHaveText('Canceled');
}

test.describe('Cancel an active booking from its Timeline bar', () => {
  // The runbook never reloads the page: every step runs on the page S01 loaded, and S08 to S11 read the screen S07 left.
  // Each test loads `/` under S01, replays its parents on that page, then selects its own step.
  test.beforeEach(async ({ page, request }, info) => {
    expect(UPSTREAM, 'RUNBOOKS_UPSTREAM_URL names the upstream server').toBeTruthy();
    const step = /^(S\d+)/.exec(info.title)![1] as Step;
    await select(request, 'S01');
    await page.goto('/');
    await expect(ui(page).rows).toHaveCount(3);
    // Let both page-load answers land before another step's fixtures take over.
    await page.waitForLoadState('networkidle');
    if (step === 'S01') return;
    // S08 to S11 read the screen the confirmed cancel left, and the cancel must happen with S07 selected.
    if (['S08', 'S09', 'S10', 'S11'].includes(step)) {
      await select(request, 'S07');
      await cancelA(page);
      await select(request, step);
      return;
    }
    // S02 to S07 and S12 send nothing before their own actions: the runbook-level fixtures answer them.
    await select(request, step);
    // S02 starts with the pointer resting on bar A, as S01 left it; S05 with the dialog S04 opened.
    if (step === 'S02') await hover(ui(page).r1Bars.first());
    if (step === 'S05') await openFromTimeline(page);
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext();
    await api.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: null, mode: 'live' } });
    await api.dispose();
  });

  test('S01 Hovering an active bar shows its full label and the (x) at its right end', async ({ page }) => {
    const f = ui(page);
    await expect(f.r1Bars).toHaveCount(1);
    await expect(f.r2Bars).toHaveCount(1);
    const bar = f.r1Bars.first();
    const l = label(bar);

    // Before the hover.
    await expectActiveBar(bar, 'A [10,20)', 'Booking A · [10,20) · active');
    await expectAtTenPercent(bar);
    await expectTruncatedAtRest(bar);
    await expect(f.x('A')).toHaveCount(0);
    const atRest = hiddenX(bar, 'A');
    await expect(atRest).toHaveCount(1);
    await expect(atRest).toHaveCSS('display', 'none');
    const afterLabel = await bar.evaluate((b, name) => {
      const lbl = b.querySelector('span.truncate');
      const btn = Array.from(b.querySelectorAll('button')).find((x) => x.getAttribute('aria-label') === name);
      return !!lbl && !!btn && !!(lbl.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING);
    }, xName('A'));
    expect(afterLabel, 'the (x) comes after the label inside bar A').toBe(true);

    // While the pointer rests on bar A.
    const before = await box(bar);
    const t = await box(track(bar));
    await hover(bar);
    const x = f.x('A');
    await expect(x).toBeVisible();
    await expect(bar.getByRole('button', { name: xName('A'), exact: true })).toHaveCount(1);
    await expect.poll(async () => (await box(bar)).width).toBeGreaterThan(before.width);
    expect(Math.abs((await box(bar)).left - t.left - t.width / 10), 'left edge stays at 10% of the track').toBeLessThanOrEqual(0.5);
    await expect(l).toHaveText('A [10,20)');
    await expect.poll(() => overflow(l)).toBeLessThanOrEqual(0);

    await expect(x).toHaveCSS('width', '18px');
    await expect(x).toHaveCSS('height', '18px');
    const radius = parseFloat(await x.evaluate((e) => getComputedStyle(e).borderTopLeftRadius));
    expect(radius, 'round button (rounded-full)').toBeGreaterThanOrEqual(9);
    const [r, g, b, a] = await rgba(x, 'background-color');
    expect([r, g, b], 'white background').toEqual([255, 255, 255]);
    expect(a, 'translucent background').toBeGreaterThan(0);
    expect(a, 'translucent background').toBeLessThan(255);
    const icon = x.locator('svg');
    await expect(icon).toHaveCount(1);
    await expect(icon).toHaveCSS('width', '12px');
    await expect(icon).toHaveCSS('height', '12px');

    const [bb, lb, xb] = [await box(bar), await box(l), await box(x)];
    expect(xb.left, 'inside the bar').toBeGreaterThanOrEqual(bb.left);
    expect(xb.top, 'inside the bar').toBeGreaterThanOrEqual(bb.top);
    expect(xb.right, 'inside the bar').toBeLessThanOrEqual(bb.right);
    expect(xb.bottom, 'inside the bar').toBeLessThanOrEqual(bb.bottom);
    expect(xb.left, 'at or right of the label').toBeGreaterThanOrEqual(Math.floor(lb.right));
    expect(Math.round(bb.right - xb.right), 'at the bar\'s right end').toBe(INSET);
    await expect(bar).toHaveAttribute('title', 'Booking A · [10,20) · active');

    await expect(hiddenX(f.r2Bars.first(), 'B')).toHaveCSS('display', 'none');
  });

  test('S02 Moving the pointer off the bar hides the (x)', async ({ page }) => {
    const f = ui(page);
    const bar = f.r1Bars.first();

    await moveOff(page);

    await expect(hiddenX(bar, 'A')).toHaveCSS('display', 'none');
    await expect(f.x('A')).toHaveCount(0);
    await expectAtTenPercent(bar);
    await expectTruncatedAtRest(bar);
  });

  test('S03 A canceled bar shows no (x) on hover', async ({ page }) => {
    const f = ui(page);
    await expect(f.r3Bars).toHaveCount(1);
    const bar = f.r3Bars.first();

    await expectCanceledBar(bar, 'C [50,60)', 'Booking C · [50,60) · canceled');
    await hover(bar);

    await expect(label(bar)).toHaveText('C [50,60)');
    await expect.poll(() => overflow(label(bar))).toBeLessThanOrEqual(0);
    await expect(bar).toHaveCSS('text-decoration-line', 'line-through');
    await expect(bar.locator('button')).toHaveCount(0);
    await expect(f.x('C')).toHaveCount(0);
  });

  test('S04 Clicking the (x) opens the table\'s confirmation dialog and sends nothing', async ({ page, request }) => {
    const f = ui(page);

    await openFromTimeline(page);

    await expect(f.dialog.getByRole('heading')).toHaveText('Cancel booking A?');
    await expect(f.dialog.getByText('R1 [10,20) becomes free. The id A stays taken.', { exact: true })).toBeVisible();
    await expect(f.dialog.getByRole('button')).toHaveText(['Keep booking', 'Cancel booking']);
    await expect(f.keep).toHaveCSS('border-top-style', 'solid');
    await expect(f.keep).toHaveCSS('border-top-color', BORDER);
    await expect(f.confirm).toHaveCSS('color', DESTRUCTIVE);
    const [r, g, b, a] = await rgba(f.confirm, 'background-color');
    expect(a, 'Cancel booking has a background').toBeGreaterThan(0);
    expect(r, 'light red background').toBeGreaterThan(g);
    expect(r, 'light red background').toBeGreaterThan(b);

    expect(await state(request)).toEqual({ requests: [], unmatched: [] });
    await expect(f.card).toHaveCount(0);
    await expect(f.entries).toHaveCount(0);
  });

  test('S05 Keep booking closes the dialog and sends nothing', async ({ page, request }) => {
    await ui(page).keep.click();
    await expectNothingSent(page, request);
  });

  test('S06 Escape closes the dialog and sends nothing', async ({ page, request }) => {
    await openFromTimeline(page);
    await page.keyboard.press('Escape');
    await expectNothingSent(page, request);
  });

  test('S07 Confirming in the dialog sends the cancel for A, then re-fetches the list', async ({ page, request }) => {
    const f = ui(page);

    await openFromTimeline(page);
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

  test('S08 A\'s bar turns Canceled in place and no longer shows the (x)', async ({ page }) => {
    const f = ui(page);
    await expect(f.r1Bars).toHaveCount(1);
    const bar = f.r1Bars.first();

    await expectCanceledBar(bar, 'A [10,20)', 'Booking A · [10,20) · canceled');
    await expectAtTenPercent(bar);
    await expect(bar).toHaveCSS('opacity', '1');

    await hover(bar);
    await expect(bar.locator('button')).toHaveCount(0);
    await expect(f.x('A')).toHaveCount(0);
  });

  test('S09 A\'s row in the Bookings table turns Canceled and no longer offers Cancel', async ({ page }) => {
    const f = ui(page);
    const row = f.rows.nth(0);

    await expect(f.rows).toHaveCount(3);
    await expect(row.getByRole('cell')).toHaveText(['A', 'R1 · Agora Room', '[10,20)', 'Canceled', '']);
    await expect(row.getByRole('button')).toHaveCount(0);
    await expect(f.rowCancel('A')).toHaveCount(0);
    await expect(badge(row)).toHaveCSS('background-color', CHIP_CANCELED.background);
    await expect(badge(row)).toHaveCSS('color', CHIP_CANCELED.color);
    await expect(row).toHaveCSS('opacity', '1');
    await expect(f.rows.locator('td:first-child')).toHaveText(['A', 'B', 'C']);
    await expect(f.chip('All')).toHaveText('All (3)');
    await expect(f.chip('Active')).toHaveText('Active (1)');
    await expect(f.chip('Canceled')).toHaveText('Canceled (2)');
  });

  test('S10 The result card says A was canceled and its id stays taken', async ({ page }) => {
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

  test('S11 The Operation log records only the cancel, with the API\'s answer', async ({ page }) => {
    const { entries } = ui(page);

    await expect(entries).toHaveCount(1);
    const reply = await expectEntry(entries.first(), { n: 1, call: 'POST /bookings/A/cancel', status: 200, color: LOG_GREEN });
    expect(reply).toEqual(CANCEL_REPLY);
  });

  test('S12 Clicking an active bar outside the (x) does nothing', async ({ page, request }) => {
    const f = ui(page);
    await expect(f.r2Bars).toHaveCount(1);
    const bar = f.r2Bars.first();
    const cardsBefore = await f.card.allInnerTexts();
    const entriesBefore = await f.entries.allInnerTexts();

    await hover(bar);
    await expect(f.x('B')).toBeVisible();
    await label(bar).click({ position: { x: 4, y: 4 } });

    await expect(f.dialog).toHaveCount(0);
    expect(await state(request)).toEqual({ requests: [], unmatched: [] });
    await expectActiveBar(bar, 'B [30,40)', 'Booking B · [30,40) · active');
    await expectActiveRow(f.rows.nth(1), 'B', 'R2 · Pixel Room', '[30,40)');
    expect(await f.card.allInnerTexts()).toEqual(cardsBefore);
    expect(await f.entries.allInnerTexts()).toEqual(entriesBefore);
  });
});
