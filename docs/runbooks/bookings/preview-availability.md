---
id: bookings.preview-availability
title: See whether an interval is free while picking it, without booking
capability: bookings
surface: ui
feature: preview-availability
tags: []
roles: []
upstream: mocked
covers:
  entries: ["/", "GET /resources", "GET /bookings", "GET /availability"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "SCH-10", "file web/src/components/bookings/bookings-page.tsx", "text \"The live availability preview now sends the form Id with the check (id param only when Id is not empty). A 409 id_taken shows Id X was already used by another booking in the conflict colors, with no preview box and Book disabled. Changing the Id re-runs the check. An invalid Id (422) shows the neutral failure text.\"", "diff main", "SCH-19", "text \"SCH-19 follow-up: the Operation log no longer logs GET /resources, GET /bookings (page load, Retry) nor the GET /bookings re-fetch after a write; it logs only the calls a user action sends: POST /bookings, POST /bookings/:id/cancel and each GET /availability the live preview sends\"", "text \"SCH-19 follow-up 3: the page no longer sends an availability check when End is not after Start (End <= Start). The preview treats it like any other interval it cannot check: the line shows the neutral idle text 'Pick a start and an end from 0 to 100', no preview box, no rings, Book disabled, no GET /availability sent and no Operation log entry.\""]
scripts: ["web/e2e/bookings/preview-availability.runbook.spec.ts"]
status: active
last_run:
  date: 2026-11-06
  oldest: 2026-11-06
  commit: "5269ad5"
  result: passed
  report: _runs/2026-11-06-0257-bookings.preview-availability.md
  runs:
    r1: { date: 2026-11-06, commit: "5269ad5", report: _runs/2026-11-06-0257-bookings.preview-availability.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
    S08: passed r1
    S09: passed r1
    S10: passed r1
---

# See whether an interval is free while picking it, without booking

---

## Goal

On the bookings home page, while the user picks a resource, a start and an end, the preview line under the fields says whether the interval is available or names the conflicting booking ids, and the timeline draws a dashed preview box and rings the conflicting bookings. The check is the page's availability check (there is no Check button) and it creates nothing. The "Book" button follows the preview: it is enabled only while the line says the interval is available, and disabled for a conflict, a taken id, a failed check or fields that cannot be checked. Fields that cannot be checked (an empty field, a value outside 0 to 100, or a start that is not before the end) send no check and show the idle text "Pick a start and an end from 0 to 100". When "Id" is filled, the check carries it, and an id some booking already has shows on the line instead of the interval's answer. Every check the page sends shows in the Operation log once it answers, with its query and the reply, green for a 2xx reply and red otherwise, so a 200 that reports a conflict is green while the preview line is orange.

---

## Preconditions

- Services: the upstream server (`npm run runbooks:upstream`, on `http://127.0.0.1:4010`) and the web app started with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run dev:web`. Before each step, the runbook and the step are selected on the server (`POST /__runbooks/select` with `{ "runbook": "bookings.preview-availability", "mode": "mocked", "step": "<Sxx>" }`).
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/preview-availability/`. They answer `GET /resources` with R1 to R5 (R1 "Agora Room", R2 "Pixel Room"), `GET /bookings` with two active bookings, A on R1 `[10,20)` and B on R1 `[20,30)`, and `GET /availability` for each interval the steps pick. `S05/` holds a hand-written 500 for R1 `[40,50)`. `get--availability-id-taken.json` is a hand-written 409 `id_taken` for R1 `[30,40)` with `id=A` (S09, S10). A check with any other id matches the fixture of its interval, whose query names no `id`, so `id=D` for R1 `[30,40)` answers "available".
- Recording only (`/runbooks:run bookings.preview-availability --record`): `docker compose up -d db` and `npm run dev:api`, with the `booking` table empty. Then, directly against the API at `http://localhost:3001` (not through the upstream server, so the setup is not recorded), `POST /bookings` with `{"id":"A","resource":"R1","start":10,"end":20}` and `{"id":"B","resource":"R1","start":20,"end":30}`, both answered 201. Skip S05 while recording (its fixture is hand-written), or delete any file the recording writes in `S05/` other than `get--availability-0-server-error.json`. Over A and B, the API answers `id=A` with the same 409 as the hand-written fixture, so a recorded copy of it can replace `get--availability-id-taken.json`.
- Field entry: "Set" means replacing the field's whole value at once (Playwright `fill`), so no request goes out for a half-typed number or id. "Id" is empty in every step that does not set it.
- Reading the Operation log: the newest entry is on top. Each entry's first line is its number (`#n`, in gray) then the call (`GET /availability?resource=R1&start=30&end=40`, query string included, `&id=<Id>` last when "Id" is filled), in white. Below it, the reply: `→ <status>` on its own line, then the reply body printed as JSON with 2-space indents, both in the tone color: green (`#86EFAC`) for a 2xx status, red (`#FCA5A5`) otherwise. An Expected writes the body on one line (`{"available": true, "conflicts": []}`); the page prints it over several lines. The page load (`GET /resources` and `GET /bookings`) adds no entry, so the log is empty after `/` opens, showing only its heading "Operation log". In this flow its entries are the availability checks only, the first one numbered `#1`. A check's entry is referred to by its call and its position, not by its number.

---

## Steps

### S01. An interval that touches a booking but does not overlap it shows as available

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the timeline to show the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Leave "Resource" on "R1 · Agora Room".
3. Set "Start" to 30.
4. Set "End" to 40.

Expected: the preview line under the fields reads "R1 [30,40) is available", in green (`#166534` on `#ECF7F0`). On the timeline, the R1 row shows a dashed green box (2px dashed `#15803D` on a light green fill) from 30 to 40. Neither bar "A [10,20)" nor "B [20,30)" has a ring. No other row shows a preview box. The "Book" button is enabled. The top entry of the Operation log is `GET /availability?resource=R1&start=30&end=40` with `→ 200` and `{"available": true, "conflicts": []}`, in green.

---

### S02. An overlapping interval lists the conflicting ids in the order the API returns them

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Leave "Resource" on "R1 · Agora Room".
3. Set "Start" to 19.
4. Set "End" to 21.

Expected: the preview line reads "R1 [19,21) conflicts with A, B", in orange (`#9A3412` on `#FFF1E8`). On the timeline, the R1 row shows a dashed orange box (2px dashed `#C2410C` on a light orange fill) from 19 to 21, and the bars "A [10,20)" and "B [20,30)" each carry a ring: a 2px white gap, then a 2px `#C2410C` outline. The "Book" button is disabled. The top entry of the Operation log is `GET /availability?resource=R1&start=19&end=21` with `→ 200` and `{"available": false, "conflicts": ["A", "B"]}`, in green: the request succeeded, so the entry is green while the preview line is orange.

---

### S03. Checking an interval creates nothing

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 19 and "End" to 21, and wait for "R1 [19,21) conflicts with A, B".
3. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the Bookings table still shows the chips "All (2)", "Active (2)" and "Canceled (0)", with the rows A and B, both "Active". No result card appears under "Book". The Operation log has exactly one entry, `GET /availability?resource=R1&start=19&end=21` with `→ 200`, in green. No entry's call starts with `POST`. `requests` holds only `GET` requests: `GET /resources`, `GET /bookings` and `GET /availability` with query `resource=R1`, `start=19`, `end=21` and no `id` key, since "Id" is empty. It holds no `POST`.

---

### S04. A start that is not before the end sends no check and disables Book

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 30.
3. Set "End" to 20.
4. Wait one second, then read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "Pick a start and an end from 0 to 100", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box on any row and no ring on any bar. The "Book" button is disabled. `requests` holds `GET /resources` and `GET /bookings`, and no `GET /availability`. The Operation log has no entries: only its heading "Operation log" shows.

---

### S05. A failed availability request shows the neutral failure text and disables Book

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 40.
3. Set "End" to 50.

Expected: the preview line reads "Couldn't check availability", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box and no ring. The "Book" button is disabled. `requests` from `GET /__runbooks/state` holds `GET /availability` with query `resource=R1`, `start=40`, `end=50`, answered 500. The top entry of the Operation log is `GET /availability?resource=R1&start=40&end=50` with `→ 500` and `{"statusCode": 500, "message": "Internal server error"}`, in red.

---

### S06. The preview follows the selected resource

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Choose "R2 · Pixel Room" in "Resource".
3. Set "Start" to 19.
4. Set "End" to 21.

Expected: the preview line reads "R2 [19,21) is available", in green (`#166534` on `#ECF7F0`). The dashed green box from 19 to 21 is on the R2 row. The R1 row shows no preview box, and the bars "A [10,20)" and "B [20,30)" have no ring. The "Book" button is enabled. The top entry of the Operation log is `GET /availability?resource=R2&start=19&end=21` with `→ 200` and `{"available": true, "conflicts": []}`, in green.

---

### S07. With empty fields the line asks for an interval and no check is sent

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Leave "Start" and "End" empty.
3. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "Pick a start and an end from 0 to 100", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box and no ring. The "Book" button is disabled. `requests` holds `GET /resources` and `GET /bookings`, and no `GET /availability`. The Operation log has no entries: only its heading "Operation log" shows.

---

### S08. A value outside 0 to 100 clears the preview and sends no check

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 19 and "End" to 21, and wait for "R1 [19,21) conflicts with A, B".
3. Set "End" to 101.
4. Wait one second, then read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "Pick a start and an end from 0 to 100", in gray (`#3A404C` on `#F1F3F6`). The dashed orange box is gone from the R1 row and the bars "A [10,20)" and "B [20,30)" no longer have a ring. The "Book" button is disabled. `requests` holds one `GET /availability`, with query `resource=R1`, `start=19`, `end=21`, and none with `end=101`. The top entry of the Operation log is still `GET /availability?resource=R1&start=19&end=21` with `→ 200`, in green, and no entry's call contains `end=101`.

---

### S09. An Id some booking already has shows the taken text and disables Book

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Id" to A.
3. Leave "Resource" on "R1 · Agora Room".
4. Set "Start" to 30.
5. Set "End" to 40.
6. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "Id A was already used by another booking", in orange (`#9A3412` on `#FFF1E8`, the conflict colors). The timeline shows no dashed preview box on any row, and the bars "A [10,20)" and "B [20,30)" have no ring. The "Book" button is disabled. `requests` holds one `GET /availability`, with query `resource=R1`, `start=30`, `end=40`, `id=A`, answered 409. The top entry of the Operation log is `GET /availability?resource=R1&start=30&end=40&id=A` with `→ 409` and `{"error": "id_taken", "message": "This id was already used by another booking."}`, in red.

---

### S10. Changing the Id checks again and shows the new answer

Parents: S09
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Id" to A, "Start" to 30 and "End" to 40, and wait for "Id A was already used by another booking".
3. Set "Id" to D.
4. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "R1 [30,40) is available", in green (`#166534` on `#ECF7F0`). On the timeline, the R1 row shows a dashed green box (2px dashed `#15803D` on a light green fill) from 30 to 40, and the bars "A [10,20)" and "B [20,30)" have no ring. The "Book" button is enabled. `requests` holds two `GET /availability` with `resource=R1`, `start=30`, `end=40`, in this order: one with `id=A`, answered 409, then one with `id=D`, answered 200. The top entry of the Operation log is `GET /availability?resource=R1&start=30&end=40&id=D` with `→ 200` and `{"available": true, "conflicts": []}`, in green, and below it the entry `GET /availability?resource=R1&start=30&end=40&id=A` with `→ 409`, in red.

---

## Not covered

- What the API saves, and that the check writes nothing in the database: a mocked runbook proves only what the screen shows and the requests it sends (S03 checks that no `POST` went out). The `bookings.check-availability` api runbook proves the API side against Postgres.
- The booking rules behind each answer (half-open `[start, end)`, only active bookings of the same resource conflict, conflicts in ascending id order): the API decides them and the page shows its answer as is. Proven by the `bookings.check-availability` api runbook.
- The debounce of about 250 ms and "only the latest answer counts" (`web/src/components/bookings/bookings-page.tsx:110-125`): timing. The mocked server answers at once, and a browser run cannot hold one response back so that it arrives after a newer one. The same timing hides the log side of it: a check that a newer one supersedes still gets its Operation log entry when it answers, and a check the debounce cancels is never sent and never logged (`bookings-page.tsx:119-120`). With "Set" (Playwright `fill`) each step sends the checks its Expected names; typing key by key could add entries for checks sent in between, so no step counts the availability entries.
- The pending line "Checking R1 [30,40)…", with no preview box and "Book" disabled, while the answer for new fields or a new Id is on its way (`shownPreview` in `web/src/lib/bookings.ts`, `bookings-page.tsx:127-130`): it lasts only the debounce plus one round trip, too short to observe reliably. S10 proves only the answer that follows.
- The Operation log keeping only the 30 newest entries (`LOG_SIZE` and `addLog` in `web/src/lib/bookings.ts`): no step of this flow sends that many checks. Proven by the unit test "keeps at most 30 entries and keeps counting up" in `web/src/lib/bookings.test.ts`.
- The log entry of a check that gets no reply at all (`→ request failed: <message>`, in red) and of a reply that is not JSON (printed as it came): every request in this flow gets a JSON fixture from the upstream server. Proven by the unit test "shows a reply that is not JSON, and a failed request, as they came" in `web/src/lib/bookings.test.ts`.
- Which ids count as taken (an active or a canceled booking's id) and which ids the API rejects: the API decides, and the page shows its 409 as in S09. Proven by the `bookings.check-availability` api runbook (S09, S10, S13).
- An Id the API rejects as `invalid_data` (422), such as "a b": the page shows "Couldn't check availability", in gray, with no preview box and "Book" disabled, because `previewOf` in `web/src/lib/bookings.ts` treats every reply other than a 200 with `available` and `conflicts`, or a 409 `id_taken`, as a failed check. No step sends a check the API answers 422: the fields the page checks are always whole numbers from 0 to 100 with the start before the end. S05 proves the same failed text for a 500. The 422 itself is proven by the unit test "fails neutrally on a 422 or a network error" in `web/src/lib/bookings.test.ts`.
- The preview running again after a Cancel, for example "R1 [19,21) conflicts with A, B" turning into "R1 [19,21) conflicts with B" once A is canceled (`bookings-page.tsx:125`, `bookings` in the effect's dependencies): the fixtures answer one response per query within a step, so the switch cannot be replayed in a mocked step. Canceling itself is `bookings.cancel-from-table`. A created booking runs no re-check: the form clears "Id", "Start" and "End" (`bookings-page.tsx:91`), which `bookings.book-from-form` proves.
- Decimals and negative values ("2.5", "-1") in "Start" or "End": the same `isBookable` branch as S08 (`web/src/lib/bookings.ts:31-33`), so S08 stands for them.

---

## Cleanup

- None for a mocked run: nothing is written.
- After recording, the dev `booking` table holds A and B. Their ids are never reused, so the person who recorded decides whether to empty the table again.
