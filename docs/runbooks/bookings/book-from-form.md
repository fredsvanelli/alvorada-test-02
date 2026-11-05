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
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "text \"On the bookings home page, a user fills the Operation form (Id, Resource, Start, End) and presses Book: a created booking appears in the timeline and the table and the result card says it was created; rejections show invalid_data (start equal to end), id_taken and conflict with the conflicting ids, and leave nothing behind\""]
scripts: []
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "a7cb566"
  result: passed
  report: _runs/2026-11-05-0326-bookings.book-from-form.md
  runs:
    r1: { date: 2026-11-05, commit: "a7cb566", report: _runs/2026-11-05-0326-bookings.book-from-form.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
---

# Book a resource from the Operation form, or see why it was rejected

---

## Goal

On `/`, a user fills the Operation form (Id, Resource, Start, End) and clicks "Book". A created booking shows in the result card, the Bookings table, the Timeline and the Operation log, and only the Id field clears. A rejection (`conflict` with the conflicting ids, `id_taken`, `invalid_data`) shows "Rejected: nothing was created" with the API's message, adds no row or bar, and keeps every field. Book stays disabled while Start or End is empty, outside 0 to 100 or not a whole number.

---

## Preconditions

- Services: the web app (`npm run dev:web`, port 3000) started with `NEXT_PUBLIC_API_URL` set to the upstream server's URL (`http://127.0.0.1:<upstream.port>`), and the project's upstream server (`npm run runbooks:upstream`) with this runbook selected in mode `mocked`.
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/book-from-form/`. They are recorded once with `/runbooks:run bookings.book-from-form --record` against the dev API (`docker compose up -d db`, `npm run dev:api`) with an empty `booking` table, so the API holds only the seeded resources R1 `Agora Room` to R5 `Focus Room`. The steps create every booking they need through the form, with fixed ids: A R1 `[10,20)` (S01) and B R1 `[20,30)` (S02).
- Page: the run opens `/` once, with the runbook selected and no step, before S01. The runbook-level fixtures answer that first load (`GET /resources` with R1 to R5, `GET /bookings` with an empty list). No step reloads the page: each step starts on the screen the previous one left, and its own step folder answers the requests it sends.
- Request checks: "Requests" in an Expected are read from `requests` in `GET /__runbooks/state` after the step, which lists the requests the app sent since the step was selected.

---

## Steps

### S01. Booking a free interval creates it and shows it everywhere

Parents: none
Requirement: none
Page: `/`

Actions:

1. Type "A" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Type "10" in "Start" and "20" in "End".
4. Click "Book".

Expected:

- The result card under "Book" shows the code `created`, the title "Booking A created" and the detail "R1 taken for [10,20)."
- The Bookings table has one row: ID "A", Resource "R1 · Agora Room", Interval "[10,20)", Status "Active", and a "Cancel" button (label "Cancel booking A"), at full opacity. The filter chips read "All (1)", "Active (1)" and "Canceled (0)".
- The Timeline row "R1 · Agora Room" shows the bar "A [10,20)", whose tooltip is "Booking A · [10,20) · active".
- The form: "Id" is empty, "Resource" is still "R1 · Agora Room", "Start" is still "10" and "End" is still "20".
- The Operation log has one entry: `#1` `POST /bookings {"id":"A","resource":"R1","start":10,"end":20}`, and below it, in green, `→ 201 {"id":"A","resource":{"id":"R1","name":"Agora Room"},"start":10,"end":20,"status":"active"}`.
- Requests: `POST /bookings` with the body `{"id":"A","resource":"R1","start":10,"end":20}` (start and end as numbers), followed by `GET /bookings`.

---

### S02. A second booking joins the list in API order, and its log entry goes on top

Parents: S01
Requirement: none
Page: `/`

Actions:

1. Type "B" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "20" and "End" with "30".
4. Click "Book".

Expected:

- The result card shows the code `created`, the title "Booking B created" and the detail "R1 taken for [20,30)."
- The Bookings table lists two rows, A then B: "A", "R1 · Agora Room", "[10,20)", "Active"; "B", "R1 · Agora Room", "[20,30)", "Active". Both have a "Cancel" button. The chips read "All (2)", "Active (2)" and "Canceled (0)".
- The Timeline row "R1 · Agora Room" shows the bars "A [10,20)" and "B [20,30)".
- "Id" is empty; "Start" is "20" and "End" is "30".
- The Operation log shows `#2` on top, `POST /bookings {"id":"B","resource":"R1","start":20,"end":30}` with `→ 201 {"id":"B","resource":{"id":"R1","name":"Agora Room"},"start":20,"end":30,"status":"active"}` in green, and `#1` (booking A) below it.
- Requests: `POST /bookings` with the body `{"id":"B","resource":"R1","start":20,"end":30}`, followed by `GET /bookings`.

---

### S03. An overlapping interval is rejected with conflict and the conflicting ids

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Type "C" in "Id".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "19" and "End" with "21".
4. Click "Book".

Expected:

- The result card shows the code `conflict`, the title "Rejected: nothing was created" and the detail "The interval overlaps active bookings of this resource. Conflicts: A, B" (the ids in the order the API returned them).
- The Bookings table still lists only A and B ("All (2)"): no row "C". The Timeline row "R1 · Agora Room" has no bar "C [19,21)", only "A [10,20)" and "B [20,30)".
- Every field keeps its value: "Id" "C", "Resource" "R1 · Agora Room", "Start" "19", "End" "21".
- The top entry of the Operation log shows `POST /bookings {"id":"C","resource":"R1","start":19,"end":21}` and below it, in red, `→ 409 {"error":"conflict","message":"The interval overlaps active bookings of this resource.","conflicts":["A","B"]}`.
- Requests: `POST /bookings` with the body `{"id":"C","resource":"R1","start":19,"end":21}`, followed by `GET /bookings`.

---

### S04. An id already used is rejected with id_taken

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Replace "Id" with "A".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "40" and "End" with "50" (a free interval of R1).
4. Click "Book".

Expected:

- The result card shows the code `id_taken`, the title "Rejected: nothing was created" and the detail "This id was already used by another booking."
- The Bookings table still lists only A `[10,20)` and B `[20,30)` ("All (2)"). The Timeline row "R1 · Agora Room" has no bar at `[40,50)`.
- Every field keeps its value: "Id" "A", "Start" "40", "End" "50".
- The top entry of the Operation log shows `POST /bookings {"id":"A","resource":"R1","start":40,"end":50}` and below it, in red, `→ 409 {"error":"id_taken","message":"This id was already used by another booking."}`.
- Requests: `POST /bookings` with the body `{"id":"A","resource":"R1","start":40,"end":50}`, followed by `GET /bookings`.

---

### S05. Start equal to End reaches the API and is rejected with invalid_data

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Replace "Id" with "E".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "50" and "End" with "50".
4. Check that "Book" is enabled, then click it.

Expected:

- Before the click, "Book" is enabled: the form only checks that Start and End are whole numbers from 0 to 100.
- The result card shows the code `invalid_data`, the title "Rejected: nothing was created" and the detail "Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."
- The Bookings table still lists only A and B ("All (2)"); no row "E" and no bar "E" on the Timeline.
- Every field keeps its value: "Id" "E", "Start" "50", "End" "50".
- The top entry of the Operation log shows `POST /bookings {"id":"E","resource":"R1","start":50,"end":50}` and below it, in red, `→ 422 {"error":"invalid_data","message":"Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."}`.
- Requests: `POST /bookings` with the body `{"id":"E","resource":"R1","start":50,"end":50}`, followed by `GET /bookings`.

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

- After actions 2, 3 and 4, "Book" is disabled (End empty, then 101, then 2.5).
- After action 5, "Book" is enabled. It is not clicked.
- The result card and the Operation log are the ones the previous step left; the Bookings table and the Timeline do not change.
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
4. Click "Book".

Expected:

- The result card shows the code `invalid_data`, the title "Rejected: nothing was created" and the detail "Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."
- The Bookings table still lists only A and B ("All (2)"), and the Timeline row "R1 · Agora Room" has no bar at `[50,60)`.
- Every field keeps its value: "Id" empty, "Start" "50", "End" "60".
- The top entry of the Operation log shows `POST /bookings {"id":"","resource":"R1","start":50,"end":60}` and below it, in red, `→ 422 {"error":"invalid_data","message":"Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."}`.
- Requests: `POST /bookings` with the body `{"id":"","resource":"R1","start":50,"end":60}`, followed by `GET /bookings`.

---

## Not covered

- Persistence after a reload: this runbook is `mocked`, so it proves what the screen shows and the request it sends (the `requests` checks above), never what the API saves. The api runbooks `bookings.create-booking` (create, `invalid_data`, `id_taken`, `conflict`, a rejected id stays free) and `bookings.list-bookings` prove that against Postgres.
- `unknown_resource`: the UI cannot send it, because "Resource" is a select filled from `GET /resources`. Its card mapping is covered by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- The pending booking at 50% opacity in the table and the Timeline (`web/src/components/bookings/bookings-table.tsx:66`, `web/src/components/bookings/timeline.tsx:96`) and Book disabled while its request is in flight (`web/src/components/bookings/bookings-page.tsx:100`): both last only until the API answers, and the mocked server answers at once, so the browser cannot hold that state long enough to check it. The steps check the end state instead: a created booking at full opacity, and no row or bar for a rejected one.
- "Request failed" cards (network failure, Nest's 400, a 5xx, a 201 whose id does not match; `web/src/lib/bookings.ts:42-61`) and a failed re-fetch of `GET /bookings` that keeps the last good list (`web/src/components/bookings/bookings-page.tsx:81`): they need the API to fail, which a recording from the live API does not produce. A separate mocked runbook with hand-written failing fixtures (`bookings.book-from-form-upstream-errors`) could hold them; the mapping is covered by `web/src/lib/bookings.test.ts`.
- Book disabled until the first load succeeds, and the load error panel: part of opening the page, `bookings.view-home`.
- The live availability preview line and the Timeline preview box while the fields change: `bookings.preview-availability`. The steps here do not check the preview.
- The Operation log's cap of 14 entries (`web/src/components/bookings/bookings-page.tsx:29`): it needs 15 writes in one page session, and this runbook makes six.
- Cancel and canceled bookings: `bookings.cancel-from-table`.

---

## Cleanup

- Mocked runs: nothing to undo. The upstream server keeps no state between runs, and a reload clears the page's result card and Operation log.
- After a `--record` run: the dev `booking` table holds A R1 `[10,20)` and B R1 `[20,30)` created through the live API. Whoever records empties the table again, as they did before recording.
