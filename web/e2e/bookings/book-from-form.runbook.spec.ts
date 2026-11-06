// Runbook bookings.book-from-form (docs/runbooks/bookings/book-from-form.md). Change the runbook first, then /runbooks:to-test bookings.book-from-form.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { LOG_GREEN as GREEN, LOG_RED as RED, expectEntry, logEntries } from './operation-log';

const RUNBOOK = 'bookings.book-from-form';
const UPSTREAM = process.env.RUNBOOKS_UPSTREAM_URL;

const INVALID_DATA =
  'Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 100 with start before end.';
const AVAILABLE = { available: true, conflicts: [] };
const REQ_A = { id: 'A', resource: 'R1', start: 10, end: 20 };
const REQ_B = { id: 'B', resource: 'R1', start: 20, end: 30 };
const BOOKING_A = { id: 'A', resource: { id: 'R1', name: 'Agora Room' }, start: 10, end: 20, status: 'active' };
const BOOKING_B = { id: 'B', resource: { id: 'R1', name: 'Agora Room' }, start: 20, end: 30, status: 'active' };
const PICK = 'Pick a start and an end from 0 to 100';

// The page checks availability 250 ms after the last change; waiting longer proves no check follows.
const AFTER_DEBOUNCE_MS = 500;

type Step = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08';

// The runbook never reloads the page: each step starts on the screen its parents left. Each test opens `/` once with
// no step selected (the runbook-level fixtures answer that first load), replays these steps under their own selects,
// then selects its own step.
const SETUP: Record<Step, Step[]> = {
  S01: [],
  S02: ['S01'],
  S03: ['S01', 'S02'],
  S04: ['S01', 'S02'],
  S05: [],
  S06: [],
  S07: ['S01', 'S02'],
  S08: ['S01', 'S02'],
};

async function select(request: APIRequestContext, step: Step | null) {
  const res = await request.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: RUNBOOK, mode: 'mocked', step } });
  expect(res.status()).toBe(200);
}

type Sent = { method: string; path: string; query?: Record<string, string>; body?: unknown; status?: number };

// The requests to /bookings and /availability the app sent since the last select, in order. With `withStatus`, each
// availability check also carries the status the upstream server answered.
async function sent(request: APIRequestContext, withStatus = false): Promise<Sent[]> {
  const res = await request.get(`${UPSTREAM}/__runbooks/state`);
  const state = (await res.json()) as { requests: Sent[] };
  return state.requests
    .filter((r) => r.path === '/bookings' || r.path === '/availability')
    .map((r) =>
      r.path === '/availability'
        ? { method: r.method, path: r.path, query: r.query, ...(withStatus ? { status: r.status } : {}) }
        : r.method === 'POST'
          ? { method: r.method, path: r.path, body: r.body }
          : { method: r.method, path: r.path },
    );
}

// The check carries `id` only when "Id" is not empty; the query is compared whole, so no `id` means no `id` key.
const availability = (start: number, end: number, id?: string, status?: number): Sent => ({
  method: 'GET',
  path: '/availability',
  query: { resource: 'R1', start: String(start), end: String(end), ...(id === undefined ? {} : { id }) },
  ...(status === undefined ? {} : { status }),
});
const post = (body: unknown): Sent => ({ method: 'POST', path: '/bookings', body });
const list: Sent = { method: 'GET', path: '/bookings' };

const ui = (page: Page) => {
  const operation = page.getByRole('region', { name: 'Operation', exact: true });
  const timeline = page.locator('[data-slot="card"]', { has: page.getByRole('heading', { name: 'Timeline' }) });
  const book = page.getByRole('button', { name: 'Book', exact: true });
  return {
    id: page.getByLabel('Id', { exact: true }),
    resource: page.getByLabel('Resource', { exact: true }),
    start: page.getByLabel('Start', { exact: true }),
    end: page.getByLabel('End', { exact: true }),
    book,
    // The preview line sits right above "Book".
    preview: book.locator('xpath=preceding-sibling::div[1]'),
    card: operation.getByRole('status'),
    rows: page.getByRole('table').locator('tbody tr'),
    chip: (label: string) => page.getByRole('button', { name: new RegExp(`^${label} \\(\\d+\\)$`) }),
    r1Bars: timeline.getByText('R1 · Agora Room', { exact: true }).locator('..').locator('[title^="Booking "]'),
    entries: logEntries(page),
  };
};

// Waits for the preview to find the current fields available, then clicks Book and waits for the write to finish: the
// result card changes once the (unlogged) re-fetch has answered, which comes after the POST's log entry.
async function clickBook(page: Page, interval: string) {
  const { book, preview, card } = ui(page);
  await expect(preview).toHaveText(`R1 ${interval} is available`);
  await expect(book).toBeEnabled();
  const shown = async () => ((await card.count()) ? card.innerText() : null);
  const before = await shown();
  await book.click();
  await expect.poll(shown).not.toBe(before);
}

const ACTIONS: Record<Step, (page: Page) => Promise<void>> = {
  S01: async (page) => {
    const f = ui(page);
    await f.id.fill('A');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('10');
    await f.end.fill('20');
    await clickBook(page, '[10,20)');
  },
  S02: async (page) => {
    const f = ui(page);
    await f.id.fill('B');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('20');
    await f.end.fill('30');
    await clickBook(page, '[20,30)');
  },
  S03: async (page) => {
    const f = ui(page);
    await f.id.fill('C');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('19');
    await f.end.fill('21');
  },
  S04: async (page) => {
    const f = ui(page);
    await f.id.fill('');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('40');
    await f.end.fill('50');
    // Book is enabled for the free interval, and is not clicked.
    await expect(f.preview).toHaveText('R1 [40,50) is available');
    await expect(f.book).toBeEnabled();
    await f.id.fill('A');
  },
  S05: async (page) => {
    const f = ui(page);
    // End first, so replacing Id never sends a check for values a previous step left.
    await f.end.fill('');
    await f.id.fill('E');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('50');
    await f.end.fill('50');
  },
  // S06 checks Book between its actions, so its test runs them itself.
  S06: async () => {},
  S07: async (page) => {
    const f = ui(page);
    await f.id.fill('');
    await expect(f.resource).toHaveValue('R1');
    await f.start.fill('50');
    await f.end.fill('60');
    await clickBook(page, '[50,60)');
  },
  // S08 only reads the log S02 left.
  S08: async () => {},
};

async function expectCard(page: Page, code: string, title: string, detail: string) {
  const { card } = ui(page);
  await expect(card.getByText(code, { exact: true })).toBeVisible();
  await expect(card.getByText(title, { exact: true })).toBeVisible();
  await expect(card.locator('p')).toHaveText(detail);
}

// The availability check entry at `index` (0 is the top) for this query, answered as given.
async function expectCheck(page: Page, index: number, query: string, status: number, color: string, body?: unknown) {
  const reply = await expectEntry(ui(page).entries.nth(index), { call: `GET /availability?${query}`, status, color });
  if (body !== undefined) expect(reply).toEqual(body);
}

// The newest POST /bookings entry is still booking B's from S02.
async function expectLatestPostIsB(page: Page) {
  const post = ui(page).entries.filter({ hasText: 'POST /bookings' }).first();
  expect(await expectEntry(post, { call: 'POST /bookings', request: REQ_B, status: 201, color: GREEN })).toEqual(BOOKING_B);
}

async function expectRow(page: Page, index: number, id: string, interval: string) {
  const row = ui(page).rows.nth(index);
  await expect(row.getByRole('cell')).toHaveText([id, 'R1 · Agora Room', interval, 'Active', 'Cancel']);
  await expect(row.getByRole('button', { name: `Cancel booking ${id}` })).toHaveText('Cancel');
  await expect(row).toHaveCSS('opacity', '1');
}

// A and B after S02: the table and the Timeline every rejection must leave as they were.
async function expectOnlyAAndB(page: Page) {
  const f = ui(page);
  await expect(f.rows).toHaveCount(2);
  await expect(f.rows.nth(0).getByRole('cell').nth(0)).toHaveText('A');
  await expect(f.rows.nth(0).getByRole('cell').nth(2)).toHaveText('[10,20)');
  await expect(f.rows.nth(1).getByRole('cell').nth(0)).toHaveText('B');
  await expect(f.rows.nth(1).getByRole('cell').nth(2)).toHaveText('[20,30)');
  await expect(f.chip('All')).toHaveText('All (2)');
  await expect(f.r1Bars).toHaveText(['A [10,20)', 'B [20,30)']);
}

async function expectFields(page: Page, id: string, start: string, end: string) {
  const f = ui(page);
  await expect(f.id).toHaveValue(id);
  await expect(f.start).toHaveValue(start);
  await expect(f.end).toHaveValue(end);
}

// What the page shows outside the form: a step that sends nothing must leave it as it was, except for the log, which
// may only gain availability checks on top.
async function snapshot(page: Page) {
  const f = ui(page);
  const cardCount = await f.card.count();
  return {
    cardCount,
    cardText: cardCount ? await f.card.innerText() : null,
    log: await f.entries.allInnerTexts(),
    rows: await f.rows.allInnerTexts(),
    bars: await f.r1Bars.allInnerTexts(),
  };
}

async function expectUnchanged(page: Page, before: Awaited<ReturnType<typeof snapshot>>) {
  const f = ui(page);
  await expect(f.card).toHaveCount(before.cardCount);
  if (before.cardText !== null) expect(await f.card.innerText()).toBe(before.cardText);
  const log = await f.entries.allInnerTexts();
  const added = log.length - before.log.length;
  expect(log.slice(added)).toEqual(before.log);
  for (const entry of log.slice(0, added)) expect(entry).toMatch(/^#\d+\s+GET \/availability\?/);
  expect(await f.rows.allInnerTexts()).toEqual(before.rows);
  expect(await f.r1Bars.allInnerTexts()).toEqual(before.bars);
}

async function expectSent(request: APIRequestContext, expected: Sent[]) {
  await expect.poll(() => sent(request)).toEqual(expected);
}

test.describe('Book a resource from the Operation form, or see why it was rejected', () => {
  test.beforeEach(async ({ page, request }, info) => {
    expect(UPSTREAM, 'RUNBOOKS_UPSTREAM_URL names the upstream server').toBeTruthy();
    const step = /^(S\d+)/.exec(info.title)![1] as Step;
    await select(request, null);
    await page.goto('/');
    // Input typed before hydration is lost: the fields enable once the first load succeeded.
    await expect(ui(page).id).toBeEnabled();
    await expect(ui(page).chip('All')).toHaveText('All (0)');
    for (const parent of SETUP[step]) {
      await select(request, parent);
      await ACTIONS[parent](page);
    }
    await select(request, step);
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext();
    await api.post(`${UPSTREAM}/__runbooks/select`, { data: { runbook: null, mode: 'live' } });
    await api.dispose();
  });

  test('S01 Booking a free interval creates it, shows it everywhere and clears the times', async ({ page, request }) => {
    await ACTIONS.S01(page);
    const f = ui(page);

    await expectCard(page, 'created', 'Booking A created', 'R1 taken for [10,20).');

    await expect(f.rows).toHaveCount(1);
    await expectRow(page, 0, 'A', '[10,20)');
    await expect(f.chip('All')).toHaveText('All (1)');
    await expect(f.chip('Active')).toHaveText('Active (1)');
    await expect(f.chip('Canceled')).toHaveText('Canceled (0)');

    await expect(f.r1Bars).toHaveText(['A [10,20)']);
    await expect(f.r1Bars.first()).toHaveAttribute('title', 'Booking A · [10,20) · active');

    await expectFields(page, '', '', '');
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');
    await expect(f.preview).toHaveText(PICK);
    await expect(f.book).toBeDisabled();

    // The page load and the re-fetch are not logged: the POST on top, the check before the click under it.
    await expect(f.entries).toHaveCount(2);
    expect(await expectEntry(f.entries.nth(0), { call: 'POST /bookings', request: REQ_A, status: 201, color: GREEN })).toEqual(
      BOOKING_A,
    );
    await expectCheck(page, 1, 'resource=R1&start=10&end=20&id=A', 200, GREEN, AVAILABLE);

    const expected = [availability(10, 20, 'A'), post({ id: 'A', resource: 'R1', start: 10, end: 20 }), list];
    await expectSent(request, expected);
    // No re-check: nothing more arrives once the debounce has passed.
    await page.waitForTimeout(AFTER_DEBOUNCE_MS);
    expect(await sent(request)).toEqual(expected);
  });

  test('S02 A second booking joins the list in API order, and its log entries go on top', async ({ page, request }) => {
    await ACTIONS.S02(page);
    const f = ui(page);

    await expectCard(page, 'created', 'Booking B created', 'R1 taken for [20,30).');

    await expect(f.rows).toHaveCount(2);
    await expectRow(page, 0, 'A', '[10,20)');
    await expectRow(page, 1, 'B', '[20,30)');
    await expect(f.chip('All')).toHaveText('All (2)');
    await expect(f.chip('Active')).toHaveText('Active (2)');
    await expect(f.chip('Canceled')).toHaveText('Canceled (0)');

    await expect(f.r1Bars).toHaveText(['A [10,20)', 'B [20,30)']);

    await expectFields(page, '', '', '');
    await expect(f.preview).toHaveText(PICK);
    await expect(f.book).toBeDisabled();

    await expect(f.entries.nth(0).locator('span').nth(1)).toHaveText('POST /bookings');
    await expectLatestPostIsB(page);
    await expectCheck(page, 1, 'resource=R1&start=20&end=30&id=B', 200, GREEN, AVAILABLE);
    // Booking A's entries from S01 further down: its POST, then its check.
    const postA = f.entries.filter({ hasText: 'POST /bookings' }).nth(1);
    expect(await expectEntry(postA, { call: 'POST /bookings', request: REQ_A, status: 201, color: GREEN })).toEqual(BOOKING_A);
    await expectCheck(page, 3, 'resource=R1&start=10&end=20&id=A', 200, GREEN, AVAILABLE);

    const expected = [availability(20, 30, 'B'), post({ id: 'B', resource: 'R1', start: 20, end: 30 }), list];
    await expectSent(request, expected);
    await page.waitForTimeout(AFTER_DEBOUNCE_MS);
    expect(await sent(request)).toEqual(expected);
  });

  test('S03 An overlapping interval keeps Book disabled, so no conflict reaches the API', async ({ page, request }) => {
    const before = await snapshot(page);
    await ACTIONS.S03(page);
    const f = ui(page);

    await expect(f.preview).toHaveText('R1 [19,21) conflicts with A, B');
    await expect(f.book).toBeDisabled();

    await expectCard(page, 'created', 'Booking B created', 'R1 taken for [20,30).');
    // Answered 200, so green, even though the interval conflicts.
    await expectCheck(page, 0, 'resource=R1&start=19&end=21&id=C', 200, GREEN, { available: false, conflicts: ['A', 'B'] });
    await expectLatestPostIsB(page);
    await expectOnlyAAndB(page);
    await expectUnchanged(page, before);

    await expectFields(page, 'C', '19', '21');
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');

    await expectSent(request, [availability(19, 21, 'C')]);
  });

  test('S04 An id already used keeps Book disabled, so no id_taken reaches the API', async ({ page, request }) => {
    const before = await snapshot(page);
    await ACTIONS.S04(page);
    const f = ui(page);

    await expect(f.preview).toHaveText('Id A was already used by another booking');
    await expect(f.book).toBeDisabled();

    await expectCard(page, 'created', 'Booking B created', 'R1 taken for [20,30).');
    await expectCheck(page, 0, 'resource=R1&start=40&end=50&id=A', 409, RED, {
      error: 'id_taken',
      message: 'This id was already used by another booking.',
    });
    await expectCheck(page, 1, 'resource=R1&start=40&end=50', 200, GREEN, AVAILABLE);
    await expectLatestPostIsB(page);
    await expectOnlyAAndB(page);
    await expectUnchanged(page, before);

    await expectFields(page, 'A', '40', '50');
    await expect(f.resource.locator('option:checked')).toHaveText('R1 · Agora Room');

    // First the check without an id, then, last, the check with id=A; nothing to /bookings.
    await expect.poll(async () => (await sent(request, true)).at(-1)).toEqual(availability(40, 50, 'A', 409));
    const requests = await sent(request, true);
    expect(requests[0]).toEqual(availability(40, 50, undefined, 200));
    expect(requests.filter((r) => r.path === '/bookings')).toEqual([]);
  });

  test('S05 Start equal to End keeps Book disabled and sends no check', async ({ page, request }) => {
    const before = await snapshot(page);
    await ACTIONS.S05(page);
    const f = ui(page);
    await page.waitForTimeout(AFTER_DEBOUNCE_MS);

    await expect(f.preview).toHaveText(PICK);
    await expect(f.book).toBeDisabled();

    await expectUnchanged(page, before);
    expect((await f.entries.allInnerTexts()).length).toBe(before.log.length);
    await expectFields(page, 'E', '50', '50');

    expect(await sent(request)).toEqual([]);
  });

  test('S06 Book stays disabled while Start or End is empty, above 100 or not a whole number', async ({ page, request }) => {
    const f = ui(page);
    const before = await snapshot(page);

    await f.id.fill('F');
    await f.start.fill('50');
    await f.end.fill('');
    await expect(f.book).toBeDisabled();
    await expect(f.preview).toHaveText(PICK);
    await f.end.fill('101');
    await expect(f.book).toBeDisabled();
    await expect(f.preview).toHaveText(PICK);
    await f.end.fill('2.5');
    await expect(f.book).toBeDisabled();
    await expect(f.preview).toHaveText(PICK);
    await f.end.fill('60');
    await expect(f.preview).toHaveText('R1 [50,60) is available');
    await expect(f.book).toBeEnabled();

    await expectCheck(page, 0, 'resource=R1&start=50&end=60&id=F', 200, GREEN, AVAILABLE);
    await expectUnchanged(page, before);

    expect((await sent(request)).filter((r) => r.method === 'POST')).toEqual([]);
  });

  test('S07 An empty Id still reaches the API and is rejected with invalid_data', async ({ page, request }) => {
    await ACTIONS.S07(page);
    const f = ui(page);

    await expectCard(page, 'invalid_data', 'Rejected: nothing was created', INVALID_DATA);

    await expectOnlyAAndB(page);

    await expectFields(page, '', '50', '60');
    await expect(f.preview).toHaveText('R1 [50,60) is available');
    await expect(f.book).toBeEnabled();

    await expectSent(request, [
      availability(50, 60),
      post({ id: '', resource: 'R1', start: 50, end: 60 }),
      list,
      availability(50, 60),
    ]);

    // The re-fetch and the re-check it triggers were sent (above) but are not logged: the rejected POST stays on top,
    // with the check sent before the click under it. The wait lets the re-check's answer land first.
    await page.waitForTimeout(AFTER_DEBOUNCE_MS);
    const rejected = { call: 'POST /bookings', request: { id: '', resource: 'R1', start: 50, end: 60 }, status: 422, color: RED };
    expect(await expectEntry(f.entries.nth(0), rejected)).toEqual({ error: 'invalid_data', message: INVALID_DATA });
    await expectCheck(page, 1, 'resource=R1&start=50&end=60', 200, GREEN, AVAILABLE);
  });

  test('S08 Past 640px the Operation log scrolls its entries inside the panel, and the page length stays the same', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Operation log' });
    const heading = panel.getByRole('heading', { name: 'Operation log' });
    const list = panel.locator('ol');
    // The heading's offset inside the panel: focusing the list may scroll the page itself.
    const measure = async () => {
      const p = (await panel.boundingBox())!;
      const h = (await heading.boundingBox())!;
      return { height: p.height, headingOffset: h.y - p.y, page: await page.evaluate(() => document.documentElement.scrollHeight) };
    };

    const before = await measure();
    expect(before.height).toBeLessThanOrEqual(640);
    await expect(list).toHaveAttribute('tabindex', '0');
    await expect(list).toHaveCSS('overflow-y', 'auto');
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await list.focus();
    await page.keyboard.press('End');

    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expectCheck(page, 3, 'resource=R1&start=10&end=20&id=A', 200, GREEN, AVAILABLE);
    await expect(ui(page).entries.last()).toBeInViewport();
    await expect(heading).toBeVisible();
    expect(await measure()).toEqual(before);
  });
});
