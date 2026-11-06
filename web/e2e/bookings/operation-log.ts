// Operation log checks shared by the bookings runbook specs (web/src/components/bookings/operation-log.tsx).
import { expect, type Locator, type Page } from '@playwright/test';

// The tokens in web/src/app/globals.css, as the browser computes them.
export const LOG_GREEN = 'rgb(134, 239, 172)'; // --color-log-ok #86EFAC
export const LOG_RED = 'rgb(252, 165, 165)'; // --color-log-error #FCA5A5
const WHITE = 'rgb(255, 255, 255)';

// includeHidden: an open dialog marks the rest of the page aria-hidden, and the log must still be readable then.
export const logEntries = (page: Page) =>
  page.getByRole('region', { name: 'Operation log', includeHidden: true }).getByRole('listitem', { includeHidden: true });

type Expected = { n?: number; call: string; request?: unknown; status: number | string; color: string };

// One entry: "#n" and "METHOD path", then the request body (white) when the call has one, then the reply block in its
// tone: "→ <status>" on its own line and the reply body under it. Returns the reply body, parsed when it is JSON.
export async function expectEntry(entry: Locator, e: Expected): Promise<unknown> {
  if (e.n !== undefined) await expect(entry.locator('span').nth(0)).toHaveText(`#${e.n}`);
  await expect(entry.locator('span').nth(1)).toHaveText(e.call);
  const blocks = entry.locator(':scope > div');
  await expect(blocks).toHaveCount(e.request === undefined ? 2 : 3);
  if (e.request !== undefined) {
    await expect(blocks.nth(1)).toHaveCSS('color', WHITE);
    expect(await blocks.nth(1).innerText(), 'request body on indented lines').toBe(JSON.stringify(e.request, null, 2));
  }
  const reply = blocks.last();
  await expect(reply).toHaveCSS('color', e.color);
  await expect(reply).toHaveCSS('padding-left', '28px');
  const [head, ...rest] = (await reply.innerText()).split('\n');
  expect(head).toBe(`→ ${e.status}`);
  const body = rest.join('\n');
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  expect(body, 'reply JSON on indented lines').toBe(JSON.stringify(parsed, null, 2));
  return parsed;
}
