// Runbook bookings.preview-availability (docs/runbooks/bookings/preview-availability.md). Change the runbook first, then /runbooks:to-test bookings.preview-availability.
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { LOG_GREEN, LOG_RED, expectEntry, logEntries } from './operation-log';

const RUNBOOK = 'bookings.preview-availability';
const UPSTREAM = process.env.RUNBOOKS_UPSTREAM_URL;

// The preview tokens in web/src/app/globals.css (--color-preview-*), as the browser computes them.
const LINE = {
  available: { color: 'rgb(22, 101, 52)', background: 'rgb(236, 247, 240)' }, // #166534 on #ECF7F0
  conflict: { color: 'rgb(154, 52, 18)', background: 'rgb(255, 241, 232)' }, // #9A3412 on #FFF1E8
  idle: { color: 'rgb(58, 64, 76)', background: 'rgb(241, 243, 246)' }, // #3A404C on #F1F3F6
};
const BOX = {
  available: { border: 'rgb(21, 128, 61)', fill: 'rgba(21, 128, 61, 0.1)' }, // #15803D
  conflict: { border: 'rgb(194, 65, 12)', fill: 'rgba(194, 65, 12, 0.1)' }, // #C2410C
};
// A 2px white (--card) gap, then a 2px #C2410C outline.
const RING = 'rgb(255, 255, 255) 0px 0px 0px 2px, rgb(194, 65, 12) 0px 0px 0px 4px';

const IDLE = 'Pick a start and an end from 0 to 100';
const AVAILABLE = { available: true, conflicts: [] };
const FAILED = "Couldn't check availability";

type Logged = { method: string; path: string; query: Record<string, string>; status: number };

// The requests the app sent since the last select, in order.
async function requests(request: APIRequestContext): Promise<Logged[]> {
  const res = await request.get(`${UPSTREAM}/__runbooks/state`);
  const state = (await res.json()) as { requests: Logged[] };
  return state.requests.map(({ method, path, query, status }) => ({ method, path, query, status }));
}

const availability = (rs: Logged[]) => rs.filter((r) => r.method === 'GET' && r.path === '/availability');

const ui = (page: Page) => {
  const timeline = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Timeline' }) });
  const row = (label: string) => timeline.getByText(label, { exact: true }).locator('..');
  const book = page.getByRole('button', { name: 'Book', exact: true });
  return {
    id: page.getByLabel('Id', { exact: true }),
    resource: page.getByLabel('Resource', { exact: true }),
    start: page.getByLabel('Start', { exact: true }),
    end: page.getByLabel('End', { exact: true }),
    book,
    // The preview line is the block right above Book (web/src/components/bookings/operation-panel.tsx).
    line: book.locator('xpath=preceding-sibling::div[1]'),
    card: page.getByRole('region', { name: 'Operation', exact: true }).getByRole('status'),
    rows: page.getByRole('table').locator('tbody tr'),
    chip: (label: string) => page.getByRole('button', { name: new RegExp(`^${label} \\(\\d+\\)$`) }),
    entries: logEntries(page),
    // The dashed preview box sits in a row's track; the legend swatches are outside the rows.
    box: (label: string) => row(label).locator('div.relative.h-11 > div.border-2.border-dashed'),
    boxes: timeline.locator('div.relative.h-11 > div.border-2.border-dashed'),
    r1Bars: row('R1 · Agora Room').locator('[title^="Booking "]'),
    bars: timeline.locator('[title^="Booking "]'),
  };
};

async function expectLine(page: Page, text: string, tone: keyof typeof LINE) {
  const { line } = ui(page);
  await expect(line).toHaveText(text);
  await expect(line).toHaveCSS('color', LINE[tone].color);
  await expect(line).toHaveCSS('background-color', LINE[tone].background);
}

// The axis runs 0 to 100 for bookings ending at 30, so an interval's left and width are its numbers in percent.
async function expectBox(box: Locator, tone: keyof typeof BOX, start: number, end: number) {
  await expect(box).toHaveCount(1);
  await expect(box).toHaveCSS('border-top-style', 'dashed');
  await expect(box).toHaveCSS('border-top-width', '2px');
  await expect(box).toHaveCSS('border-top-color', BOX[tone].border);
  await expect(box).toHaveCSS('background-color', BOX[tone].fill);
  await expect(box).toHaveAttribute('style', new RegExp(`left: ${start}%; width: ${end - start}%`));
}

// The newest Operation log entry is the availability check with this query, answered as given.
async function expectTopCheck(page: Page, query: string, status: number, color: string, body?: unknown) {
  const reply = await expectEntry(ui(page).entries.first(), { call: `GET /availability?${query}`, status, color });
  if (body !== undefined) expect(reply).toEqual(body);
}

async function expectNoRings(page: Page) {
  const { bars } = ui(page);
  for (const bar of await bars.all()) await expect(bar).toHaveCSS('box-shadow', 'none');
}

test.describe('See whether an interval is free while picking it, without booking', () => {
  test.beforeEach(async ({ page, request }, info) => {
    expect(UPSTREAM, 'RUNBOOKS_UPSTREAM_URL names the upstream server').toBeTruthy();
    const step = /^(S\d+)/.exec(info.title)![1];
    const res = await request.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: RUNBOOK, mode: 'mocked', step } });
    expect(res.status()).toBe(200);
    await page.goto('/');
    // Input typed before hydration is lost: the fields enable once the first load succeeded.
    await expect(ui(page).start).toBeEnabled();
    await expect(ui(page).r1Bars).toHaveText(['A [10,20)', 'B [20,30)']);
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext();
    await api.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: null, mode: 'live' } });
    await api.dispose();
  });

  test('S01 An interval that touches a booking but does not overlap it shows as available', async ({ page }) => {
    const f = ui(page);
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');
    await f.start.fill('30');
    await f.end.fill('40');

    await expectLine(page, 'R1 [30,40) is available', 'available');
    await expectBox(f.box('R1 · Agora Room'), 'available', 30, 40);
    await expect(f.boxes).toHaveCount(1);
    await expectNoRings(page);
    await expect(f.book).toBeEnabled();
    await expectTopCheck(page, 'resource=R1&start=30&end=40', 200, LOG_GREEN, AVAILABLE);
  });

  test('S02 An overlapping interval lists the conflicting ids in the order the API returns them', async ({ page }) => {
    const f = ui(page);
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');
    await f.start.fill('19');
    await f.end.fill('21');

    await expectLine(page, 'R1 [19,21) conflicts with A, B', 'conflict');
    await expectBox(f.box('R1 · Agora Room'), 'conflict', 19, 21);
    await expect(f.r1Bars).toHaveText(['A [10,20)', 'B [20,30)']);
    await expect(f.r1Bars.nth(0)).toHaveCSS('box-shadow', RING);
    await expect(f.r1Bars.nth(1)).toHaveCSS('box-shadow', RING);
    await expect(f.book).toBeDisabled();
    // The request succeeded, so the entry is green while the preview line is orange.
    await expectTopCheck(page, 'resource=R1&start=19&end=21', 200, LOG_GREEN, { available: false, conflicts: ['A', 'B'] });
  });

  test('S03 Checking an interval creates nothing', async ({ page, request }) => {
    const f = ui(page);
    await f.start.fill('19');
    await f.end.fill('21');
    await expect(f.line).toHaveText('R1 [19,21) conflicts with A, B');

    await expect(f.chip('All')).toHaveText('All (2)');
    await expect(f.chip('Active')).toHaveText('Active (2)');
    await expect(f.chip('Canceled')).toHaveText('Canceled (0)');
    await expect(f.rows).toHaveCount(2);
    await expect(f.rows.nth(0).getByRole('cell').nth(0)).toHaveText('A');
    await expect(f.rows.nth(0).getByRole('cell').nth(3)).toHaveText('Active');
    await expect(f.rows.nth(1).getByRole('cell').nth(0)).toHaveText('B');
    await expect(f.rows.nth(1).getByRole('cell').nth(3)).toHaveText('Active');
    await expect(f.entries).toHaveCount(1);
    await expectTopCheck(page, 'resource=R1&start=19&end=21', 200, LOG_GREEN);
    await expect(f.entries.filter({ hasText: 'POST' })).toHaveCount(0);
    await expect(f.card).toHaveCount(0);

    const rs = await requests(request);
    expect(rs.filter((r) => r.method !== 'GET')).toEqual([]);
    // The two page-load requests go out in parallel, so the paths are compared as a set.
    expect([...new Set(rs.map((r) => r.path))].sort()).toEqual(['/availability', '/bookings', '/resources']);
    expect(availability(rs).map((r) => r.query)).toEqual([{ resource: 'R1', start: '19', end: '21' }]);
  });

  test('S04 A start that is not before the end sends no check and disables Book', async ({ page, request }) => {
    const f = ui(page);
    await f.start.fill('30');
    await f.end.fill('20');
    // Longer than the 250 ms debounce: no check follows.
    await page.waitForTimeout(1000);

    await expectLine(page, IDLE, 'idle');
    await expect(f.boxes).toHaveCount(0);
    await expectNoRings(page);
    await expect(f.book).toBeDisabled();
    expect(availability(await requests(request))).toEqual([]);
    await expect(f.entries).toHaveCount(0);
  });

  test('S05 A failed availability request shows the neutral failure text and disables Book', async ({ page, request }) => {
    const f = ui(page);
    await f.start.fill('40');
    await f.end.fill('50');

    await expectLine(page, FAILED, 'idle');
    await expect(f.boxes).toHaveCount(0);
    await expectNoRings(page);
    await expect(f.book).toBeDisabled();
    expect(availability(await requests(request)).map(({ query, status }) => ({ query, status }))).toEqual([
      { query: { resource: 'R1', start: '40', end: '50' }, status: 500 },
    ]);
    await expectTopCheck(page, 'resource=R1&start=40&end=50', 500, LOG_RED, { statusCode: 500, message: 'Internal server error' });
  });

  test('S06 The preview follows the selected resource', async ({ page }) => {
    const f = ui(page);
    await f.resource.selectOption({ label: 'R2 · Pixel Room' });
    await f.start.fill('19');
    await f.end.fill('21');

    await expectLine(page, 'R2 [19,21) is available', 'available');
    await expectBox(f.box('R2 · Pixel Room'), 'available', 19, 21);
    await expect(f.box('R1 · Agora Room')).toHaveCount(0);
    await expect(f.r1Bars.nth(0)).toHaveCSS('box-shadow', 'none');
    await expect(f.r1Bars.nth(1)).toHaveCSS('box-shadow', 'none');
    await expect(f.book).toBeEnabled();
    await expectTopCheck(page, 'resource=R2&start=19&end=21', 200, LOG_GREEN, AVAILABLE);
  });

  test('S07 With empty fields the line asks for an interval and no check is sent', async ({ page, request }) => {
    const f = ui(page);
    await expect(f.start).toHaveValue('');
    await expect(f.end).toHaveValue('');

    await expectLine(page, IDLE, 'idle');
    await expect(f.boxes).toHaveCount(0);
    await expectNoRings(page);
    await expect(f.book).toBeDisabled();

    const rs = await requests(request);
    expect([...new Set(rs.map((r) => `${r.method} ${r.path}`))].sort()).toEqual(['GET /bookings', 'GET /resources']);
    expect(availability(rs)).toEqual([]);
    await expect(f.entries).toHaveCount(0);
  });

  test('S08 A value outside 0 to 100 clears the preview and sends no check', async ({ page, request }) => {
    const f = ui(page);
    await f.start.fill('19');
    await f.end.fill('21');
    await expect(f.line).toHaveText('R1 [19,21) conflicts with A, B');
    await f.end.fill('101');
    await page.waitForTimeout(1000);

    await expectLine(page, IDLE, 'idle');
    await expect(f.box('R1 · Agora Room')).toHaveCount(0);
    await expect(f.r1Bars.nth(0)).toHaveCSS('box-shadow', 'none');
    await expect(f.r1Bars.nth(1)).toHaveCSS('box-shadow', 'none');
    await expect(f.book).toBeDisabled();
    expect(availability(await requests(request)).map((r) => r.query)).toEqual([{ resource: 'R1', start: '19', end: '21' }]);
    await expectTopCheck(page, 'resource=R1&start=19&end=21', 200, LOG_GREEN);
    await expect(f.entries.filter({ hasText: 'end=101' })).toHaveCount(0);
  });

  test('S09 An Id some booking already has shows the taken text and disables Book', async ({ page, request }) => {
    const f = ui(page);
    // Id goes first: the form is not checkable until Start and End are valid, so exactly one check goes out.
    await f.id.fill('A');
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');
    await f.start.fill('30');
    await f.end.fill('40');

    await expectLine(page, 'Id A was already used by another booking', 'conflict');
    await expect(f.boxes).toHaveCount(0);
    await expectNoRings(page);
    await expect(f.book).toBeDisabled();
    expect(availability(await requests(request)).map(({ query, status }) => ({ query, status }))).toEqual([
      { query: { resource: 'R1', start: '30', end: '40', id: 'A' }, status: 409 },
    ]);
    await expectTopCheck(page, 'resource=R1&start=30&end=40&id=A', 409, LOG_RED, {
      error: 'id_taken',
      message: 'This id was already used by another booking.',
    });
  });

  test('S10 Changing the Id checks again and shows the new answer', async ({ page, request }) => {
    const f = ui(page);
    await f.id.fill('A');
    await f.start.fill('30');
    await f.end.fill('40');
    await expect(f.line).toHaveText('Id A was already used by another booking');
    await f.id.fill('D');

    await expectLine(page, 'R1 [30,40) is available', 'available');
    await expectBox(f.box('R1 · Agora Room'), 'available', 30, 40);
    await expect(f.r1Bars.nth(0)).toHaveCSS('box-shadow', 'none');
    await expect(f.r1Bars.nth(1)).toHaveCSS('box-shadow', 'none');
    await expect(f.book).toBeEnabled();
    expect(availability(await requests(request)).map(({ query, status }) => ({ query, status }))).toEqual([
      { query: { resource: 'R1', start: '30', end: '40', id: 'A' }, status: 409 },
      { query: { resource: 'R1', start: '30', end: '40', id: 'D' }, status: 200 },
    ]);
    await expectTopCheck(page, 'resource=R1&start=30&end=40&id=D', 200, LOG_GREEN, AVAILABLE);
    await expectEntry(f.entries.nth(1), { call: 'GET /availability?resource=R1&start=30&end=40&id=A', status: 409, color: LOG_RED });
  });
});
