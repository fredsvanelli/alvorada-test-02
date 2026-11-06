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
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "text \"On the bookings home page, a user fills the Operation form (Id, Resource, Start, End) and presses Book: a created booking appears in the timeline and the table and the result card says it was created; rejections show invalid_data (start equal to end), id_taken and conflict with the conflicting ids, and leave nothing behind\"", "text \"Three behavior changes in the web UI (uncommitted on this branch, see git diff of web/src/components/bookings/bookings-page.tsx and bookings-table.tsx): (1) Book is enabled only when the live availability preview says available; it is disabled while the check is pending (\"Checking…\"), on a conflict, and on a failed check (for example start equal to end, which the availability endpoint answers 422). So the form can no longer send a conflicting interval or start=end: those steps become \"Book stays disabled\". The id is not checked by the preview, so id_taken and an empty id still reach POST /bookings when the interval is available. (2) After a created booking, Id, Start and End all clear (Resource stays), so no availability re-check runs after a create. (3) Cancel in the Bookings table now opens a confirmation dialog (not this runbook’s flow).\"", "text \"The live availability preview now sends the form’s Id with the check: GET /availability?resource=..&start=..&end=..&id=<Id> when the Id field is not empty (no id param when it is empty). The API answers 409 { error: \"id_taken\", message: \"This id was already used by another booking.\" } when a booking (active or canceled) already has that id. The preview line then shows \"Id <Id> was already used by another booking\" (tone \"taken\", conflict colors), the timeline draws no preview box, and Book stays disabled, so an already-used id never reaches POST /bookings from the form anymore. Code: web/src/lib/bookings.ts (previewOf, shownPreview), web/src/components/bookings/bookings-page.tsx (preview effect, canBook).\""]
scripts: ["web/e2e/bookings/book-from-form.runbook.spec.ts"]
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "37e3b09"
  result: passed
  report: _runs/2026-11-05-2047-bookings.book-from-form.md
  runs:
    r1: { date: 2026-11-05, commit: "37e3b09", report: _runs/2026-11-05-2047-bookings.book-from-form.md }
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

On `/`, a user fills the Operation form (Id, Resource, Start, End) and clicks "Book". "Book" is enabled only while the live availability preview under the fields says the interval is available. A created booking shows in the result card, the Bookings table, the Timeline and the Operation log, and "Id", "Start" and "End" clear ("Resource" stays), so no availability check runs after it. When "Id" is filled, the check carries it, and an id some booking already has keeps "Book" disabled, so `id_taken` never reaches `POST /bookings` from the form. An empty "Id" is not checked: it still reaches the API, which rejects it with `invalid_data`, and the page shows "Rejected: nothing was created" with the API's message, adds no row or bar, and keeps every field. An overlapping interval, Start equal to End, and a Start or End that is empty, above 100 or not a whole number keep "Book" disabled too, so nothing is sent.

---

## Preconditions

- Services: the web app (`npm run dev:web`, port 3000) started with `NEXT_PUBLIC_API_URL` set to the upstream server's URL (`http://127.0.0.1:<upstream.port>`), and the project's upstream server (`npm run runbooks:upstream`) with this runbook selected in mode `mocked`.
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/book-from-form/`. They are recorded once with `/runbooks:run bookings.book-from-form --record` against the dev API (`docker compose up -d db`, `npm run dev:api`) with an empty `booking` table, so the API holds only the seeded resources R1 `Agora Room` to R5 `Focus Room`. The steps create every booking they need through the form, with fixed ids: A R1 `[10,20)` (S01) and B R1 `[20,30)` (S02). `get--availability-id-taken.json` is hand-written: the 409 `id_taken` the API answers for R1 `[40,50)` with `id=A` (S04). Over A and B a `--record` run gets the same answer, so its recorded copy can replace that file.
- Page: the run opens `/` once, with the runbook selected and no step, before S01. The runbook-level fixtures answer that first load (`GET /resources` with R1 to R5, `GET /bookings` with an empty list). No step reloads the page: each step starts on the screen the previous one left, and its own step folder answers the requests it sends.
- Preview: the page checks availability (`GET /availability`) 250 ms after the last change to "Id", "Resource", "Start" or "End", and again after each write re-fetches the list. The query carries `id` with the value of "Id" when "Id" is not empty, and no `id` key when it is empty. A step that clicks "Book" or checks it waits until the preview line under the fields shows the answer for the current fields.
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
- The Operation log has one entry: `#1` `POST /bookings {"id":"A","resource":"R1","start":10,"end":20}`, and below it, in green, `→ 201 {"id":"A","resource":{"id":"R1","name":"Agora Room"},"start":10,"end":20,"status":"active"}`.
- Requests: `GET /availability` with query `resource=R1`, `start=10`, `end=20`, `id=A`; then `POST /bookings` with the body `{"id":"A","resource":"R1","start":10,"end":20}` (start and end as numbers); then `GET /bookings`. No `GET /availability` follows: the cleared times run no re-check.

---

### S02. A second booking joins the list in API order, and its log entry goes on top

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
- The Operation log shows `#2` on top, `POST /bookings {"id":"B","resource":"R1","start":20,"end":30}` with `→ 201 {"id":"B","resource":{"id":"R1","name":"Agora Room"},"start":20,"end":30,"status":"active"}` in green, and `#1` (booking A) below it.
- Requests: `GET /availability` with query `resource=R1`, `start=20`, `end=30`, `id=B`; then `POST /bookings` with the body `{"id":"B","resource":"R1","start":20,"end":30}`; then `GET /bookings`. No `GET /availability` follows.

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
- Nothing was sent: the result card still shows `created`, "Booking B created" and "R1 taken for [20,30).", and the top entry of the Operation log is still `#2` (booking B). The Bookings table still lists only A and B ("All (2)"): no row "C". The Timeline row "R1 · Agora Room" has no bar "C [19,21)", only "A [10,20)" and "B [20,30)".
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
- Nothing was sent: the result card still shows `created`, "Booking B created" and "R1 taken for [20,30).", and the top entry of the Operation log is still `#2` (booking B). The Bookings table still lists only A `[10,20)` and B `[20,30)` ("All (2)"), and the Timeline row "R1 · Agora Room" has no bar at `[40,50)`.
- Every field keeps its value: "Id" "A", "Resource" "R1 · Agora Room", "Start" "40", "End" "50".
- Requests: `GET /availability` with query `resource=R1`, `start=40`, `end=50` and no `id` key, answered 200; the last request is `GET /availability` with query `resource=R1`, `start=40`, `end=50`, `id=A`, answered 409. No `POST /bookings` and no `GET /bookings`.

---

### S05. Start equal to End keeps Book disabled, because the availability check fails

Parents: none
Requirement: none
Page: `/`

Actions:

1. Replace "Id" with "E".
2. Leave "Resource" on "R1 · Agora Room".
3. Replace "Start" with "50" and "End" with "50".
4. Wait until the preview line shows the answer.

Expected:

- The preview line reads "Couldn't check availability" (the availability check answers 422 `invalid_data` when start is not before end), and "Book" is disabled.
- Nothing was sent: the result card, the Operation log, the Bookings table and the Timeline are the ones the previous step left. No row "E" and no bar "E".
- Every field keeps its value: "Id" "E", "Start" "50", "End" "50".
- Requests: `GET /availability` with query `resource=R1`, `start=50`, `end=50`, `id=E`, answered 422 (the API checks the interval before the id). No `POST /bookings`.

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
4. When the preview line reads "R1 [50,60) is available" and "Book" is enabled, click "Book".

Expected:

- The result card shows the code `invalid_data`, the title "Rejected: nothing was created" and the detail "Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."
- The Bookings table still lists only A and B ("All (2)"), and the Timeline row "R1 · Agora Room" has no bar at `[50,60)`.
- Every field keeps its value: "Id" empty, "Start" "50", "End" "60".
- The preview checks the kept fields again and reads "R1 [50,60) is available", and "Book" is enabled.
- The top entry of the Operation log shows `POST /bookings {"id":"","resource":"R1","start":50,"end":60}` and below it, in red, `→ 422 {"error":"invalid_data","message":"Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end."}`.
- Requests: `POST /bookings` with the body `{"id":"","resource":"R1","start":50,"end":60}`, followed by `GET /bookings`, then the re-check `GET /availability` with query `resource=R1`, `start=50`, `end=60` and no `id` key ("Id" is empty).

---

## Not covered

- Persistence after a reload: this runbook is `mocked`, so it proves what the screen shows and the request it sends (the `requests` checks above), never what the API saves. The api runbooks `bookings.create-booking` (create, `invalid_data`, `id_taken`, `conflict`, a rejected id stays free) and `bookings.list-bookings` prove that against Postgres.
- The `id_taken` result card ("Rejected: nothing was created", "This id was already used by another booking."): the form cannot send a used id any more, because the check carries the Id and "Book" stays disabled for it (S04). A used id could still reach `POST /bookings` only when another client books it between the check and the click, and concurrency is out of scope (PRD). The API's answer is proved by `bookings.create-booking`, which ids the availability check counts as taken by `bookings.check-availability`, and the card mapping by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- The `conflict` result card ("Conflicts: A, B") and the `invalid_data` card for Start equal to End: the form cannot send these any more, because "Book" stays disabled for them (S03, S05). A conflict could still reach `POST /bookings` only when another client books the interval between the check and the click, and concurrency is out of scope (PRD). The API's answers are proved by `bookings.create-booking`, and the card mapping by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- `unknown_resource`: the UI cannot send it, because "Resource" is a select filled from `GET /resources`. Its card mapping is covered by the unit test of `bookResult` in `web/src/lib/bookings.test.ts`.
- "Book" disabled while the check is pending, with the preview line "Checking R1 [a,b)…" (`web/src/lib/bookings.ts:160-162`, `web/src/components/bookings/bookings-page.tsx:119`): it lasts only the 250 ms debounce plus the mocked answer, too short to observe reliably. The steps wait for the answer instead. The text is covered by the unit test of `shownPreview` in `web/src/lib/bookings.test.ts`.
- The pending booking at 50% opacity in the table and the Timeline (`web/src/components/bookings/bookings-table.tsx:75`, `web/src/components/bookings/timeline.tsx:81`) and Book disabled while its request is in flight (`web/src/components/bookings/bookings-page.tsx:119`): both last only until the API answers, and the mocked server answers at once, so the browser cannot hold that state long enough to check it. The steps check the end state instead: a created booking at full opacity, and no row or bar for a rejected one.
- "Request failed" cards (network failure, Nest's 400, a 5xx, a 201 whose id does not match; `web/src/lib/bookings.ts:49-78`) and a failed re-fetch of `GET /bookings` that keeps the last good list (`web/src/components/bookings/bookings-page.tsx:77`): they need the API to fail, which a recording from the live API does not produce. A separate mocked runbook with hand-written failing fixtures (`bookings.book-from-form-upstream-errors`) could hold them; the mapping is covered by `web/src/lib/bookings.test.ts`.
- Book disabled until the first load succeeds, and the load error panel: part of opening the page, `bookings.view-home`.
- The preview's colors (the conflict colors of a taken id too), the Timeline preview box and its absence for a taken id, the rings on conflicting bars, and a failed availability request (network error or 5xx): `bookings.preview-availability`. The steps here read the preview line only as the condition that enables or disables "Book".
- The Operation log's cap of 14 entries (`web/src/lib/bookings.ts:20`): it needs 15 writes in one page session, and this runbook makes three (S01, S02, S07).
- Cancel, its confirmation dialog, and canceled bookings: `bookings.cancel-from-table`.

---

## Cleanup

- Mocked runs: nothing to undo. The upstream server keeps no state between runs, and a reload clears the page's result card and Operation log.
- After a `--record` run: the dev `booking` table holds A R1 `[10,20)` and B R1 `[20,30)` created through the live API. Whoever records empties the table again, as they did before recording.
