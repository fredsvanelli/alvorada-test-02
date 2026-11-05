# SCH-10: Web UI to list, create, check and cancel bookings

Sharpened spec from the grill session on SCH-10. Inputs: `.issues/issues/SCH-10/issue.md`, `.issues/docs/PRD.md`, `GLOSSARY.md` (unchanged), `docs/adr/0001-nested-resource-in-booking-responses.md`, `api/openapi.yaml`, the prototype `.design/prototype-html/Main.dc.html`, and `docs/runbooks/runbooks.config.json`.

## Why

Every endpoint now exists (SCH-6 create, SCH-7 availability, SCH-8 cancel and list), but `web/src/app/page.tsx` is still the SCH-3 placeholder and the web app cannot reach the API. SCH-10 builds the one page the PRD demo, the README (SCH-11) and the walkthrough video use: book, see availability, cancel, and watch what the API answers.

## Goals

- One page, laid out like the prototype: Operation panel (form, live preview, Book, result card) on the left; Timeline, Bookings table and Operation log on the right.
- Every API outcome visible in the UI with the API's own codes: created, `invalid_data`, `unknown_resource`, `id_taken`, `conflict` with ids, available, conflicts with ids, canceled, `already_canceled`, `not_found`.
- The API stays the only judge of the booking rules. The UI never computes overlaps or sorts ids.
- Lint, typecheck and build pass; the new runbooks pass.

## Non-goals

- The prototype's R6 to R10, its resource type line ("Room · 8 seats"), its own codes (`id_in_use`, `booking_not_found`, `already_cancelled`) and its id auto-suggestion.
- A Check button (see "Departure from the issue").
- Authentication, editing a booking, dark mode, mobile-specific layouts, concurrency.
- Browser e2e specs (Playwright) and component tests.
- Any change to the API contract: `api/openapi.yaml` stays as it is. CORS is not part of the contract.

## Anti-goals

- A second copy of the `[start, end)` rule in the browser (the prototype's `conflitos`). The preview asks the API.
- Re-sorting ids in the UI. The prototype sorts with `localeCompare(..., { numeric: true })`, which contradicts the glossary's **Ascending id order** (by character code). Lists and conflicts are shown in the order the API returns them.
- Words the glossary rules out on screen: "Cancelled", "Period".

## Departures from the issue

The issue body is not edited. One comment on SCH-10 records both departures, so the review does not flag them.

1. **No Check button.** The issue scope says "two actions: Book (`POST /bookings`) and Check (`GET /availability`)", and the prototype has both buttons. The live preview line is the availability check. It shows "available" or the conflicting ids in ascending order, and it creates nothing, which meets acceptance criterion 3.
2. **The UI can't cancel a booking twice.** Criterion 4 says "canceling it again shows `already_canceled`". Decided after the builder check: a Canceled row shows nothing in its Action cell, and there is no cancel-by-id. So the second cancel is reachable only from a stale row (one canceled from another tab or by curl). The UI still maps `already_canceled` to its result card. The mapping unit test covers that, and the API behavior is proven by the `bookings.cancel-booking` api runbook. The first half of criterion 4 ("canceling a booking updates the list") is met as specified.

## API access

- The page is a client component (`"use client"`) that calls the API from the browser with `fetch`.
- Base URL: `process.env.NEXT_PUBLIC_API_URL`, falling back to `http://localhost:3001`. New file `web/.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:3001`. The runbooks upstream server sets the same variable (`runbooks.config.json` `upstream.urlEnv`).
- `api/src/main.ts`: `app.enableCors({ origin: config.getOrThrow('WEB_ORIGIN') })`, read through `ConfigService` like `API_PORT`. `api/.env.example` gets `WEB_ORIGIN=http://localhost:3000`. Existing `api/.env` files need that line too, because `getOrThrow` fails without it. The setup note in `CLAUDE.md` says so.
- `CLAUDE.md` documents both variables.
- Error bodies use the key `error` (`{ error, message, conflicts? }`, `BookingError` in the contract), not `code`.
- Cancel calls `POST /bookings/${encodeURIComponent(id)}/cancel`.

## Operation panel

| Field | Control | Default | Rule |
|---|---|---|---|
| Id | shadcn `Input`, text, in the prototype's empty slot above Resource | empty | Sent exactly as typed. No client validation. |
| Resource | native `<select>` from `GET /resources`, options `R1 · Agora Room` | R1 | — |
| Start, End | shadcn `Input` `type="number"` `min=0` `max=100` `step=1`, two-column grid | empty | Book is disabled while either is empty, outside 0..100 or not a whole number. |

- Start ≥ end and a bad or empty id still reach the API, so `invalid_data` stays reachable from the UI.
- **Book**: full width (the row the prototype split between Book and Check). Primary style (`#1D4ED8`), 44px tall. Disabled while its request is in flight, while the fields fail the rule above, and while the initial load has not succeeded.
- After a **created**, only the id clears. After a rejection, every field keeps its value.

### Live preview (the availability check)

- When resource, start or end changes and the fields pass the rule above, call `GET /availability?resource=&start=&end=`, debounced about 250 ms. Only the latest response counts: an older response that arrives late is ignored.
- The preview line under the fields (13px, radius 8px, padding 8px 10px):

| State | Text | Colors (fg / bg) |
|---|---|---|
| Fields fail the rule | "Pick a start and an end from 0 to 100" (no call) | `#3A404C` / `#F1F3F6` |
| `available: true` | "R1 [19,21) is available" | `#166534` / `#ECF7F0` |
| `available: false` | "R1 [19,21) conflicts with A, B" (API order) | `#9A3412` / `#FFF1E8` |
| Request failed, or start ≥ end (422) | "Couldn't check availability" | `#3A404C` / `#F1F3F6` |

  When start ≥ end, the API answers 422. The line shows the neutral failure text, and Book stays enabled so that `invalid_data` can be demonstrated.
- On the timeline, the selected resource's row shows a dashed preview box (2px dashed, radius 8px, top 2px, height 40px): green `#15803D` on `rgba(21,128,61,0.10)` when available, orange `#C2410C` on `rgba(194,65,12,0.10)` when there are conflicts. Each conflicting bar gets the ring `0 0 0 2px #FFFFFF, 0 0 0 4px #C2410C`.
- The preview runs again after each write's re-fetch, so booking `[19,21)` turns the line from "available" into "conflicts with D".

### Result card

Below Book, `role="status"`. It shows the latest Book or Cancel outcome as a title, a detail line and the API code in mono. It is hidden until the first write.

| Outcome | Palette | Title | Detail |
|---|---|---|---|
| created | ok | Booking D created | R1 taken for [19,21). |
| `invalid_data`, `unknown_resource`, `id_taken`, `conflict` | error | Rejected: nothing was created | The API's `message`; for `conflict` also "Conflicts: A, B" |
| canceled | ok | Booking A canceled | Its id stays taken. |
| `already_canceled` | warning | Booking A was already canceled | Nothing changed. |
| `not_found` | error | Booking not found | The API's `message` |
| network error, or a reply outside the contract (Nest's 400, a 5xx, a body that doesn't parse) | error | Request failed | The HTTP status if there was one, and the raw body |

Palettes (bg / border / fg / code chip): ok `#ECF7F0 / #A7D7B8 / #14532D / #15803D`, error `#FDEEEE / #F1B4B4 / #7F1D1D / #B91C1C`, warning `#FFF4E8 / #F5C79A / #7C2D12 / #C2410C`.

## Timeline

- One row per resource: a label column of 132px showing `R1` in mono and ` · Agora Room`. A track 44px tall, `#F8F9FB`, radius 6px, with vertical tick lines `#E2E5EA`. Rows separated by a `#E8EBEF` top border, padding 8px 0. The content has a minimum width of 520px and scrolls horizontally inside the card.
- Legend (12px, `#565D6B`): Active, Canceled, Preview: available, Preview: conflict, with the prototype's swatches.
- Bars: top 6px, height 32px, radius 6px, mono 12px label `A [10,20)`, ellipsis on overflow, `title` "Booking A · [10,20) · active".
  - Active: `#1D4ED8` background and border, white text.
  - Canceled: `#EEF0F3` background, `1px dashed #8A919E`, `#565D6B` text, line-through.
  - Canceled bars render under active ones.
- Axis from 0 to `max(100, largest end among the bookings)`, rounded up to a multiple of 10. The tick step is `max(5, ceil(span / 6 / 5) * 5)`, so there are about 6 ticks, labelled in mono 11px. Bookings created outside the UI (curl, SCH-9) stay visible. `ponytail:` comment: one huge booking squeezes the others into slivers; add zoom or clipping if that ever matters.

## Bookings table

- Header: "Bookings" plus filter chips **All (n) / Active (n) / Canceled (n)**. The chips are pill buttons 36px tall with `aria-pressed`: selected `#15171C` with white text; the others white with a `#C9CED6` border. Filtering happens in the browser.
- shadcn `Table`. Columns **ID** (mono, 600), **Resource** (`R1` mono · name), **Interval** (`[10,20)` mono), **Status** (shadcn `Badge`: Active `#E3EAFD/#1E3A8A`, Canceled `#EEF0F3/#3A404C`), **Action** (right-aligned). The headers are 12px uppercase, letter-spacing 0.06em, `#565D6B`.
- Rows appear in API order. An Active row has a **Cancel** button (36px, white, `#C9CED6` border, `aria-label="Cancel booking A"`), disabled while that booking's own request is in flight. A Canceled row's Action cell is empty (no button, no text; the prototype's "ID stays taken" is dropped).
- When the filter matches nothing: "No bookings in this filter."

## Writes and state

- State: `resources`, `bookings` (from `GET /bookings`), the form, the preview, the result card, the log and the filter.
- Book and Cancel run inside a transition with React 19's `useOptimistic` over `bookings`:
  - Book adds `{ id, resource: { id, name }, start, end, status: "active" }`, marked pending.
  - Cancel switches that booking to `canceled`, marked pending.
  - Pending entries render at 50% opacity in both the table and the timeline.
- After any response (success, rejection or failure), re-fetch `GET /bookings` inside the same transition. When the transition ends, the optimistic state drops away and the real list shows. A rejected create leaves no ghost row, because a rejection writes nothing.
- **Load failure** (`GET /resources` or `GET /bookings` fails on load): one error panel replaces the timeline and the table. It reads "Can't reach the API at {base URL}. Start it with `npm run dev:api`." and has a Retry button. The form stays visible but disabled. No automatic retries, backoff or timeouts.

## Operation log

- A dark card (`#15171C`, `#E6E8EC` text, white "Operation log" title), an ordered list in mono 13px, entries separated by `#2A2E36`.
- Each entry shows `#n` (`#8F96A3`) and the call in white, for example `POST /bookings {"id":"C","resource":"R1","start":19,"end":21}` or `POST /bookings/A/cancel`. Below it, indented 28px: `→ 409 {"error":"conflict",…}`, colored ok `#86EFAC`, error `#FCA5A5`, warning `#FDBA74` (`already_canceled`) or info `#93C5FD`. A network failure shows `→ request failed: <message>`.
- Only Book and Cancel are logged, not the preview or the initial loads. The log lives in memory, newest first, holds at most 14 entries, and is lost on reload.

## Look

- shadcn components added with the CLI (`npx shadcn@latest add input table badge card` from `web/`; the style is `base-nova` on `@base-ui/react`): `Input`, `Table`, `Badge`, `Card`, restyled to the prototype. No new npm dependency beyond what the CLI copies in. If the CLI wants a package that is not installed, stop and ask.
- Page: background `#F4F5F7`, text `#15171C`, 15px / line-height 1.45, max width 1240px, padding 32px 20px 48px, gap 24px. The `h1` "Bookings" is 32px, 700, letter-spacing -0.01em.
- Cards: white, 1px `#DDE1E7`, radius 12px, padding 20px. Each card title (`h2`) is 17px, 600.
- Controls: 44px tall, radius 8px, `#C9CED6` border, values in mono 15px. Labels are 13px, 500, `#3A404C`. The focus ring is `2px solid #1D4ED8`, offset 2px.
- Layout: a flex row that wraps. The Operation column is `flex: 1 1 320px`; the right column is `flex: 999 1 560px` with a 24px gap between its cards.
- Fonts: IBM Plex Sans (400, 500, 600, 700) and IBM Plex Mono (400, 500, 600) through `next/font/google` in `layout.tsx`, replacing Geist.
- `globals.css`: the prototype's palette becomes the shadcn variables (`--background #F4F5F7`, `--foreground #15171C`, `--card #FFFFFF`, `--primary #1D4ED8`, `--border #DDE1E7`, `--input #C9CED6`, `--ring #1D4ED8`, `--muted-foreground #565D6B`, `--radius` 12px…). The one-off colors (result and log palettes, preview colors, bar colors) become named tokens next to them. The unused `.dark` block can go.
- The words on screen follow the glossary: Interval, Canceled, "Preview: available".

## Tests and runbooks

- Pure helpers in `web/src/lib/`, with no React and no `@/` imports, so Node can run them directly:
  - the axis scale (ticks and positions)
  - form validity (the Book-enabled rule)
  - the mapping from an API response to the result card's title, detail, palette and code

  They're tested by one `web/src/lib/*.test.ts` file using `node:test` and `node:assert`, run with `node --test` (Node 22.22 strips types). `web/package.json` gets `"test"`. The root `npm test` runs both workspaces (`npm test --workspaces`). Api tests still need Postgres.
- Runbooks:
  - Fill the placeholder `bookings.view-home`: the page loads R1 to R5 and the bookings.
  - Create `ui` runbooks with `/runbooks:create`:
    - book: created, plus `invalid_data` (start ≥ end), `id_taken` and `conflict` with ids
    - live preview: available, then conflicts with ids, with nothing created
    - cancel: canceled, with the list updated and the row's Cancel button gone
  - **Data: record once, then mocked.** In `live` mode the upstream server forwards to the dev database, which ids never leave, so a live run passes only once. Instead, record each step's API responses once with the upstream server in `record` mode, against an empty `booking` table, into `docs/runbooks/_fixtures/<runbook>/`. Then run the runbooks in `mocked` mode, which replays those fixtures per step. The runs are repeatable and leave demo data alone. The api runbooks already prove the API's behavior against Postgres; the ui runbooks prove the page renders each answer. Emptying the dev table for the one recording session is a manual step: the person recording runs it, or the agent runs it after asking.
  - Run them with `/runbooks:run --affected`. The `runbooks-playwright` MCP server failed to connect this session. Use Claude in Chrome, or restart the server.
  - `unknown_resource`, `not_found` and `already_canceled` can't be reached from this UI: the resource is a select, Cancel only appears on Active rows, and there is no cancel-by-id. The mapping test covers them.

## Left to the builder

- File split inside `web/src/` (one page component plus small presentational components, or one file), and how the debounce and the "latest wins" guard are written (`AbortController` or a sequence counter).
- The exact Tailwind classes, as long as the values above come out.

## Calls made by the spec writer (not discussed in the grill)

- The preview treats a 422 (start ≥ end) as "Couldn't check availability" and keeps Book enabled, so `invalid_data` can be shown by booking.
- Book is also disabled until the initial load succeeds.
- The result card is hidden until the first write.
- The code chip colors in the result palettes come from the prototype's `chipBg`.
- Existing `api/.env` files need the new `WEB_ORIGIN` line. `CLAUDE.md`'s setup note says so.
- The unused `.dark` block in `globals.css` can be removed (dark mode is out of scope).
