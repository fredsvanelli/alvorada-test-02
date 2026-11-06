---
id: bookings.book-from-form
title: Book a resource from the Operation form, or see why it was rejected
capability: bookings
surface: ui
feature: book
tags: []
roles: []
upstream: mocked
covers:
  entries: ["/", "POST /bookings", "GET /bookings", "GET /resources", "GET /availability"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "text \"On the bookings home page, a user fills the Operation form (Id, Resource, Start, End) and presses Book: a created booking appears in the timeline and the table and the result card says it was created; rejections show invalid_data (start equal to end), id_taken and conflict with the conflicting ids, and leave nothing behind\"", "text \"Three behavior changes in the web UI (uncommitted on this branch, see git diff of web/src/components/bookings/bookings-page.tsx and bookings-table.tsx): (1) Book is enabled only when the live availability preview says available; it is disabled while the check is pending (\"Checking…\"), on a conflict, and on a failed check (for example start equal to end, which the availability endpoint answers 422). So the form can no longer send a conflicting interval or start=end: those steps become \"Book stays disabled\". The id is not checked by the preview, so id_taken and an empty id still reach POST /bookings when the interval is available. (2) After a created booking, Id, Start and End all clear (Resource stays), so no availability re-check runs after a create. (3) Cancel in the Bookings table now opens a confirmation dialog (not this runbook’s flow).\"", "text \"The live availability preview now sends the form’s Id with the check: GET /availability?resource=..&start=..&end=..&id=<Id> when the Id field is not empty (no id param when it is empty). The API answers 409 { error: \"id_taken\", message: \"This id was already used by another booking.\" } when a booking (active or canceled) already has that id. The preview line then shows \"Id <Id> was already used by another booking\" (tone \"taken\", conflict colors), the timeline draws no preview box, and Book stays disabled, so an already-used id never reaches POST /bookings from the form anymore. Code: web/src/lib/bookings.ts (previewOf, shownPreview), web/src/components/bookings/bookings-page.tsx (preview effect, canBook).\"", "SCH-16", "diff main", "SCH-19", "text \"SCH-19 follow-up: the Operation log no longer logs GET /resources, GET /bookings (page load, Retry) nor the GET /bookings re-fetch after a write; it logs only the calls a user action sends: POST /bookings, POST /bookings/:id/cancel and each GET /availability the live preview sends\"", "text \"SCH-19 follow-up 2: the availability re-check that runs by itself after a write (the fields stay filled after a rejected Book, and the re-fetched list re-runs the preview) is still sent but no longer logged in the Operation log. Only checks sent after the user edits a field (Id, Resource, Start, End) are logged.\"", "text \"SCH-19 follow-up 3: the page no longer sends an availability check when End is not after Start (End <= Start). The preview treats it like any other interval it cannot check: the line shows the neutral idle text 'Pick a start and an end from 0 to 100', Book stays disabled, no GET /availability is sent and no Operation log entry is added.\""]
scripts: ["web/e2e/bookings/book-from-form.runbook.spec.ts"]
status: active
last_run:
  date: 2026-11-06
  oldest: 2026-11-06
  commit: "35b4bfb"
  result: passed
  report: _runs/2026-11-06-0356-bookings.book-from-form.md
  runs:
    r1: { date: 2026-11-06, commit: "35b4bfb", report: _runs/2026-11-06-0356-bookings.book-from-form.md }
  cells:
    S01: passed r1
    S02: passed r1
    S08: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
---

# Book a resource from the Operation form, or see why it was rejected

---

## Goal

On `/`, a user fills the Operation form (Id, Resource, Start, End) and clicks "Book". "Book" is enabled only while the live availability preview under the fields says the interval is available. The Operation log shows the calls a user action sends, each when it answers: every availability check the preview sends after the user edits a field, and every `POST /bookings`. The page load, the `GET /bookings` re-fetch after a write and the availability re-check that re-fetch triggers add no entry. Past 640px the log's entries scroll inside its panel, which stays at most 640px tall. A created booking shows in the result card, the Bookings table, the Timeline and the Operation log (its `POST /bookings` entry), and "Id", "Start" and "End" clear ("Resource" stays), so no availability check runs after it. When "Id" is filled, the check carries it, and an id some booking already has keeps "Book" disabled, so `id_taken` never reaches `POST /bookings` from the form. An empty "Id" is not checked: it still reaches the API, which rejects it with `invalid_data`, and the page shows "Rejected: nothing was created" with the API's message, adds no row or bar, and keeps every field. An overlapping interval keeps "Book" disabled too, so no booking is sent. An End that is not after Start (Start equal to End included), and a Start or End that is empty, above 100 or not a whole number, send no availability check at all: the preview line reads "Pick a start and an end from 0 to 100", "Book" stays disabled, and nothing is sent or logged.

---

## Preconditions

- Services: the web app (`npm run dev:web`, port 3000) started with `NEXT_PUBLIC_API_URL` set to the upstream server's URL (`http://127.0.0.1:<upstream.port>`), and the project's upstream server (`npm run runbooks:upstream`) with this runbook selected in mode `mocked`.
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/book-from-form/`. They are recorded once with `/runbooks:run bookings.book-from-form --record` against the dev API (`docker compose up -d db`, `npm run dev:api`) with an empty `booking` table, so the API holds only the seeded resources R1 `Agora Room` to R5 `Focus Room`. The steps create every booking they need through the form, with fixed ids: A R1 `[10,20)` (S01) and B R1 `[20,30)` (S02). `get--availability-id-taken.json` is hand-written: the 409 `id_taken` the API answers for R1 `[40,50)` with `id=A` (S04). Over A and B a `--record` run gets the same answer, so its recorded copy can replace that file. `post--bookings-1b4a279a.json` is the 2026-11-05 recording edited by hand for SCH-16, so its `invalid_data` message says "from 0 to 100".
- Page: the run opens `/` once, with the runbook selected and no step, before S01. The runbook-level fixtures answer that first load (`GET /resources` with R1 to R5, `GET /bookings` with an empty list). Once both answer, the Operation log is empty: the page logs neither call. No step reloads the page: each step starts on the screen the previous one left, and its own step folder answers the requests it sends.
- Operation log: the page adds an entry on top of the Operation log when each call a user action sends answers: every `GET /availability` the preview sends after the user edits "Id", "Resource", "Start" or "End", and for each click on "Book" the `POST /bookings` entry when the POST answers. The page load (`GET /resources`, `GET /bookings`), the `GET /bookings` re-fetch after each click on "Book", and the `GET /availability` re-check that re-fetch triggers when the fields stay filled are sent but not logged. An entry's first line is `#<n>` then the method and the path; an availability check's path carries its query in the order `resource`, `start`, `end`, `id` (`GET /availability?resource=R1&start=10&end=20&id=A`). Under it, for a request with a body, the request body printed as JSON with 2-space indents, in white. Then, in the entry's tone, `→ <status>` on its own line and the reply body printed as JSON with 2-space indents. A `GET` entry is green on a 2xx and red otherwise; a `POST /bookings` entry has the tone of its result card (green for `created`, red for a rejection). The steps write bodies on one line (`{"available":true,"conflicts":[]}`); the page prints them over several lines, as S01 shows in full. How many availability checks a step sends depends on typing speed (one per 250 ms pause), so the steps name entries by their content and their order, never by number or count.
- Preview: the page checks availability (`GET /availability`) 250 ms after the last change to "Id", "Resource", "Start" or "End", and again after each write re-fetches the list, but only while "Start" and "End" are whole numbers from 0 to 100 with Start before End. Any other Start and End (one empty, above 100, not a whole number, or an End not after Start) send no check: the preview line reads "Pick a start and an end from 0 to 100" and "Book" is disabled. The query carries `id` with the value of "Id" when "Id" is not empty, and no `id` key when it is empty. A step that clicks "Book" or checks it waits until the preview line under the fields shows the answer for the current fields.
- Request checks: "Requests" in an Expected are read from `requests` in `GET /__runbooks/state` after the step, which lists the requests the app sent since the step was selected.

---

## Steps

### S01. Booking a free interval creates it, shows it everywhere and clears the times

Parents: none
Requirement: none
Page: `/`

Actions:

1. Type "A" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Type "10" in "Start" and "20" in "End".
4. When the preview line reads "R1 [10,20) is available" and "Book" is enabled, click "Book".

Expected:

- The result card under "Book" shows the code `created`, the title "Booking A created" and the detail "R1 taken for [10,20)."
- The Bookings table has one row: ID "A", Resource "R1 · Agora Room", Interval "[10,20)", Status "Active", and a "Cancel" button (label "Cancel booking A"), at full opacity. The filter chips read "All (1)", "Active (1)" and "Canceled (0)".
- The Timeline row "R1 · Agora Room" shows the bar "A [10,20)", whose tooltip is "Booking A · [10,20) · active".
- The form: "Id", "Start" and "End" are empty, and "Resource" is still "R1 · Agora Room". The preview line reads "Pick a start and an end from 0 to 100" and "Book" is disabled.
- The top entry of the Operation log is the `POST /bookings` entry (the `GET /bookings` re-fetch adds no entry). Its first line is `#<n>` and `POST /bookings`; under it the request body in white, and then `→ 201` and the reply body in green, exactly these lines:

  ```text
  {
    "id": "A",
    "resource": "R1",
    "start": 10,
    "end": 20
  }
  → 201
  {
    "id": "A",
    "resource": {
      "id": "R1",
      "name": "Agora Room"
    },
    "start": 10,
    "end": 20,
    "status": "active"
  }
  ```

- Right below the `POST /bookings` entry is `GET /availability?resource=R1&start=10&end=20&id=A` with `→ 200` and `{"available":true,"conflicts":[]}`, in green, and nothing is below it: the page load logged nothing.
- Requests: `GET /availability` with query `resource=R1`, `start=10`, `end=20`, `id=A`; then `POST /bookings` with the body `{"id":"A","resource":"R1","start":10,"end":20}` (start and end as numbers); then `GET /bookings` (sent, not logged). No `GET /availability` follows: the cleared times run no re-check.

---

### S02. A second booking joins the list in API order, and its log entries go on top

Parents: S01
Requirement: none
Page: `/`

Actions:

1. Type "B" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Type "20" in "Start" and "30" in "End".
4. When the preview line reads "R1 [20,30) is available" (B starts where A ends) and "Book" is enabled, click "Book".

Expected:

- The result card shows the code `created`, the title "Booking B created" and the detail "R1 taken for [20,30)."
- The Bookings table lists two rows, A then B: "A", "R1 · Agora Room", "[10,20)", "Active"; "B", "R1 · Agora Room", "[20,30)", "Active". Both have a "Cancel" button. The chips read "All (2)", "Active (2)" and "Canceled (0)".
- The Timeline row "R1 · Agora Room" shows the bars "A [10,20)" and "B [20,30)".
- "Id", "Start" and "End" are empty. The preview line reads "Pick a start and an end from 0 to 100" and "Book" is disabled.
- The top entry of the Operation log is `POST /bookings` with the request body `{"id":"B","resource":"R1","start":20,"end":30}` in white, then `→ 201` and `{"id":"B","resource":{"id":"R1","name":"Agora Room"},"start":20,"end":30,"status":"active"}`, in green (the `GET /bookings` re-fetch adds no entry). Right below it is `GET /availability?resource=R1&start=20&end=30&id=B` with `→ 200` and `{"available":true,"conflicts":[]}`, in green.
- Below those, booking A's entries from S01 are still listed: `POST /bookings` with the request body `{"id":"A","resource":"R1","start":10,"end":20}` and `→ 201`, in green, and below it, at the bottom, `GET /availability?resource=R1&start=10&end=20&id=A` with `→ 200`, in green.
- Requests: `GET /availability` with query `resource=R1`, `start=20`, `end=30`, `id=B`; then `POST /bookings` with the body `{"id":"B","resource":"R1","start":20,"end":30}`; then `GET /bookings` (sent, not logged). No `GET /availability` follows.

---

### S08. Past 640px the Operation log scrolls its entries inside the panel, and the page length stays the same

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Read the bounding height of the Operation log panel (the `section` titled "Operation log"), the distance from the panel's top to the top of its heading "Operation log", and `document.documentElement.scrollHeight`.
2. Focus the entry list (the `ol` inside the panel) and press End (or set its `scrollTop` to its `scrollHeight`).
3. Read the same three values again.

Expected:

- The step starts on the screen S02 left, or a later step that kept it (the log holds at least S02's entries: two `POST /bookings` entries with multi-line request and reply bodies, and their checks, together taller than 640px).
- Before action 2, the panel's bounding height is at most 640px. Its entry list has `tabIndex` 0 and the computed `overflow-y: auto`, and its `scrollHeight` is greater than its `clientHeight`: the entries do not all fit.
- After action 2, the list's `scrollTop` is greater than 0, and the bottom entry, booking A's check `GET /availability?resource=R1&start=10&end=20&id=A` with `→ 200`, shows inside the list.
- The heading "Operation log" has not moved inside the panel: the heading's top minus the panel's top is the same as before action 2 (focusing the list may scroll the page itself, so the page positions can change). The panel's bounding height and `document.documentElement.scrollHeight` are the same as before action 2.
- Requests: none. S08 sends no request, so no fixture answers it and it has no step folder.

---

### S03. An overlapping interval keeps Book disabled, so no conflict reaches the API

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Type "C" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Type "19" in "Start" and "21" in "End".
4. Wait until the preview line shows the answer.

Expected:

- The preview line reads "R1 [19,21) conflicts with A, B" (the ids in the order the API returned them), and "Book" is disabled.
- Nothing was sent: the result card still shows `created`, "Booking B created" and "R1 taken for [20,30).". The Bookings table still lists only A and B ("All (2)"): no row "C". The Timeline row "R1 · Agora Room" has no bar "C [19,21)", only "A [10,20)" and "B [20,30)".
- The Operation log has no new `POST /bookings` entry: the latest `POST /bookings` entry is still booking B's (`→ 201`), and every entry above it is a `GET /availability` check. The top entry is `GET /availability?resource=R1&start=19&end=21&id=C` with `→ 200` and `{"available":false,"conflicts":["A","B"]}`, in green (the check answered 200, even though the interval conflicts).
- Every field keeps its value: "Id" "C", "Resource" "R1 · Agora Room", "Start" "19", "End" "21".
- Requests: `GET /availability` with query `resource=R1`, `start=19`, `end=21`, `id=C` (C is free, so the API answers the interval's conflicts). No `POST /bookings`.

---

### S04. An id already used keeps Book disabled, so no id_taken reaches the API

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Clear "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "40" and "End" with "50" (a free interval of R1).
4. Wait until the preview line reads "R1 [40,50) is available" and "Book" is enabled. Do not click it.
5. Type "A" in "Id" (the id of booking A, created in S01).
6. Wait until the preview line shows the answer.

Expected:

- The preview line reads "Id A was already used by another booking", and "Book" is disabled.
- Nothing was sent: the result card still shows `created`, "Booking B created" and "R1 taken for [20,30).". The Bookings table still lists only A `[10,20)` and B `[20,30)` ("All (2)"), and the Timeline row "R1 · Agora Room" has no bar at `[40,50)`.
- The Operation log has no new `POST /bookings` entry: the latest `POST /bookings` entry is still booking B's (`→ 201`), and the entries this step added are `GET /availability` checks only. The top entry is `GET /availability?resource=R1&start=40&end=50&id=A` with `→ 409` and `{"error":"id_taken","message":"This id was already used by another booking."}`, in red. Right below it is `GET /availability?resource=R1&start=40&end=50` with `→ 200` and `{"available":true,"conflicts":[]}`, in green.
- Every field keeps its value: "Id" "A", "Resource" "R1 · Agora Room", "Start" "40", "End" "50".
- Requests: `GET /availability` with query `resource=R1`, `start=40`, `end=50` and no `id` key, answered 200; the last request is `GET /availability` with query `resource=R1`, `start=40`, `end=50`, `id=A`, answered 409. No `POST /bookings` and no `GET /bookings`.

---

### S05. Start equal to End keeps Book disabled and sends no check

Parents: none
Requirement: none
Page: `/`

Actions:

1. Clear "End" (so no field change below makes a checkable interval, whatever the previous step left).
2. Replace "Id" with "E".
3. Leave "Resource" on "R1 · Agora Room".
4. Replace "Start" with "50".
5. Type "50" in "End".
6. Wait 1 second, past the 250 ms debounce.

Expected:

- The preview line reads "Pick a start and an end from 0 to 100", and "Book" is disabled.
- Nothing was sent: the result card, the Bookings table and the Timeline are the ones the step found. No row "E" and no bar "E".
- The Operation log is the one the step found: this step added no entry at all, neither a `GET /availability` check nor a `POST /bookings`.
- Every field keeps its value: "Id" "E", "Resource" "R1 · Agora Room", "Start" "50", "End" "50".
- Requests: none. No `GET /availability` (an End not after Start is never checked) and no `POST /bookings`.

---

### S06. Book stays disabled while Start or End is empty, above 100 or not a whole number

Parents: none
Requirement: none
Page: `/`

Actions:

1. Replace "Id" with "F" and "Start" with "50".
2. Clear "End".
3. Type "101" in "End".
4. Replace "End" with "2.5".
5. Replace "End" with "60".

Expected:

- After actions 2, 3 and 4, "Book" is disabled (End empty, then 101, then 2.5), and the preview line reads "Pick a start and an end from 0 to 100".
- After action 5, once the preview line reads "R1 [50,60) is available", "Book" is enabled. It is not clicked.
- The result card is the one the previous step left; the Bookings table and the Timeline do not change.
- The Operation log has no new `POST /bookings` entry: the latest `POST /bookings` entry is still the one the previous step left, and the entries this step added are `GET /availability` checks only (an empty End, 101 and 2.5 send no check). After action 5, the top entry is `GET /availability?resource=R1&start=50&end=60&id=F` with `→ 200` and `{"available":true,"conflicts":[]}`, in green.
- Requests: no `POST /bookings`.

---

### S07. An empty Id still reaches the API and is rejected with invalid_data

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Clear "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "50" and "End" with "60".
4. When the preview line reads "R1 [50,60) is available" and "Book" is enabled, click "Book".

Expected:

- The result card shows the code `invalid_data`, the title "Rejected: nothing was created" and the detail "Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 100 with start before end."
- The Bookings table still lists only A and B ("All (2)"), and the Timeline row "R1 · Agora Room" has no bar at `[50,60)`.
- Every field keeps its value: "Id" empty, "Start" "50", "End" "60".
- The preview checks the kept fields again and reads "R1 [50,60) is available", and "Book" is enabled.
- The Operation log, from the top: `POST /bookings` with the request body `{"id":"","resource":"R1","start":50,"end":60}` in white, and `→ 422` and `{"error":"invalid_data","message":"Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 100 with start before end."}`, in red; then the check sent before the click, `GET /availability?resource=R1&start=50&end=60` with `→ 200` and `{"available":true,"conflicts":[]}`, in green. The `GET /bookings` re-fetch and the re-check it triggers add no entry.
- Requests: `POST /bookings` with the body `{"id":"","resource":"R1","start":50,"end":60}`, followed by `GET /bookings` (sent, not logged), then the re-check `GET /availability` with query `resource=R1`, `start=50`, `end=60` and no `id` key ("Id" is empty; sent, not logged).

---

## Not covered

- Persistence after a reload: this runbook is `mocked`, so it proves what the screen shows and the request it sends (the `requests` checks above), never what the API saves. The api runbooks `bookings.create-booking` (create, `invalid_data`, `id_taken`, `conflict`, a rejected id stays free) and `bookings.list-bookings` prove that against Postgres.
- The `id_taken` result card ("Rejected: nothing was created", "This id was already used by another booking."): the form cannot send a used id any more, because the check carries the Id and "Book" stays disabled for it (S04). A used id could still reach `POST /bookings` only when another client books it between the check and the click, and concurrency is out of scope (PRD). The API's answer is proved by `bookings.create-booking`, which ids the availability check counts as taken by `bookings.check-availability`, and the card mapping by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- The `conflict` result card ("Conflicts: A, B") and the `invalid_data` card for Start equal to End: the form cannot send these any more, because "Book" stays disabled for them: an overlapping interval gets a conflict from the check (S03), and Start equal to End is never checked (S05). A conflict could still reach `POST /bookings` only when another client books the interval between the check and the click, and concurrency is out of scope (PRD). The API's answers are proved by `bookings.create-booking`, and the card mapping by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- `unknown_resource`: the UI cannot send it, because "Resource" is a select filled from `GET /resources`. Its card mapping is covered by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- "Book" disabled while the check is pending, with the preview line "Checking R1 [a,b)…" (`web/src/lib/bookings.ts:162-164`, `web/src/components/bookings/bookings-page.tsx:119`): it lasts only the 250 ms debounce plus the mocked answer, too short to observe reliably. The steps wait for the answer instead. The text is covered by the unit test of `shownPreview` in `web/src/lib/bookings.test.ts`.
- The pending booking at 50% opacity in the table and the Timeline (`web/src/components/bookings/bookings-table.tsx:66`, `web/src/components/bookings/timeline.tsx:85`) and Book disabled while its request is in flight (`web/src/components/bookings/bookings-page.tsx:119`): both last only until the API answers, and the mocked server answers at once, so the browser cannot hold that state long enough to check it. The steps check the end state instead: a created booking at full opacity, and no row or bar for a rejected one.
- "Request failed" cards (network failure, Nest's 400, a 5xx, a 201 whose id does not match; `web/src/lib/bookings.ts:51-80`) and a failed re-fetch of `GET /bookings` that keeps the last good list (`web/src/components/bookings/bookings-page.tsx:77`): they need the API to fail, which a recording from the live API does not produce. A separate mocked runbook with hand-written failing fixtures (`bookings.book-from-form-upstream-errors`) could hold them; the mapping is covered by `web/src/lib/bookings.test.ts`.
- Book disabled until the first load succeeds, and the load error panel: part of opening the page, `bookings.view-home`.
- The preview's colors (the conflict colors of a taken id too), the Timeline preview box and its absence for a taken id, the rings on conflicting bars, and a failed availability request (network error or 5xx): `bookings.preview-availability`. The steps here read the preview line only as the condition that enables or disables "Book".
- The Operation log's cap of 30 entries, with the numbers still counting up past it (`web/src/lib/bookings.ts:22`): reaching it needs more than 30 calls in one page session, and how many checks this runbook sends depends on typing speed. Covered by the unit test of `addLog` in `web/src/lib/bookings.test.ts`.
- Log entries for a reply that is not JSON (printed as the raw text under `→ <status>`) and for a network failure (one line `→ request failed: <message>`, in red): the fixtures answer JSON and never fail. Covered by the "log text" unit tests of `describeReply` and `replyTone` in `web/src/lib/bookings.test.ts`.
- Cancel, its confirmation dialog, and canceled bookings: `bookings.cancel-from-table`.

---

## Cleanup

- Mocked runs: nothing to undo. The upstream server keeps no state between runs, and a reload clears the page's result card and Operation log.
- After a `--record` run: the dev `booking` table holds A R1 `[10,20)` and B R1 `[20,30)` created through the live API. Whoever records empties the table again, as they did before recording.
