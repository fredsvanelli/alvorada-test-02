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
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "SCH-10"]
scripts: []
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "a7cb566"
  result: passed
  report: _runs/2026-11-05-0326-bookings.preview-availability.md
  runs:
    r1: { date: 2026-11-05, commit: "a7cb566", report: _runs/2026-11-05-0326-bookings.preview-availability.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
    S08: passed r1
---

# See whether an interval is free while picking it, without booking

---

## Goal

On the bookings home page, while the user picks a resource, a start and an end, the preview line under the fields says whether the interval is available or names the conflicting booking ids, and the timeline draws a dashed preview box and rings the conflicting bookings. The check is the page's availability check (there is no Check button) and it creates nothing.

---

## Preconditions

- Services: the upstream server (`npm run runbooks:upstream`, on `http://127.0.0.1:4010`) and the web app started with `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run dev:web`. Before each step, the runbook and the step are selected on the server (`POST /__runbooks/select` with `{ "runbook": "bookings.preview-availability", "mode": "mocked", "step": "<Sxx>" }`).
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/preview-availability/`. They answer `GET /resources` with R1 to R5 (R1 "Agora Room", R2 "Pixel Room"), `GET /bookings` with two active bookings, A on R1 `[10,20)` and B on R1 `[20,30)`, and `GET /availability` for each interval the steps pick. `S05/` holds a hand-written 500 for R1 `[40,50)`.
- Recording only (`/runbooks:run bookings.preview-availability --record`): `docker compose up -d db` and `npm run dev:api`, with the `booking` table empty. Then, directly against the API at `http://localhost:3001` (not through the upstream server, so the setup is not recorded), `POST /bookings` with `{"id":"A","resource":"R1","start":10,"end":20}` and `{"id":"B","resource":"R1","start":20,"end":30}`, both answered 201. Skip S05 while recording (its fixture is hand-written), or delete any file the recording writes in `S05/` other than `get--availability-0-server-error.json`.
- Field entry: "Set" means replacing the field's whole value at once (Playwright `fill`), so no request goes out for a half-typed number.

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

Expected: the preview line under the fields reads "R1 [30,40) is available", in green (`#166534` on `#ECF7F0`). On the timeline, the R1 row shows a dashed green box (2px dashed `#15803D` on a light green fill) from 30 to 40. Neither bar "A [10,20)" nor "B [20,30)" has a ring. No other row shows a preview box.

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

Expected: the preview line reads "R1 [19,21) conflicts with A, B", in orange (`#9A3412` on `#FFF1E8`). On the timeline, the R1 row shows a dashed orange box (2px dashed `#C2410C` on a light orange fill) from 19 to 21, and the bars "A [10,20)" and "B [20,30)" each carry a ring: a 2px white gap, then a 2px `#C2410C` outline.

---

### S03. Checking an interval creates nothing

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 19 and "End" to 21, and wait for "R1 [19,21) conflicts with A, B".
3. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the Bookings table still shows the chips "All (2)", "Active (2)" and "Canceled (0)", with the rows A and B, both "Active". The Operation log has no entry and no result card appears under "Book". `requests` holds only `GET` requests: `GET /resources`, `GET /bookings` and `GET /availability` with query `resource=R1`, `start=19`, `end=21`. It holds no `POST`.

---

### S04. A start that is not before the end shows the neutral failure text and leaves Book enabled

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 30.
3. Set "End" to 20.

Expected: the preview line reads "Couldn't check availability", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box on any row and no ring on any bar. The "Book" button is enabled. `requests` from `GET /__runbooks/state` holds `GET /availability` with query `resource=R1`, `start=30`, `end=20` (answered 422).

---

### S05. A failed availability request shows the neutral failure text

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Set "Start" to 40.
3. Set "End" to 50.

Expected: the preview line reads "Couldn't check availability", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box and no ring. The "Book" button is enabled. `requests` from `GET /__runbooks/state` holds `GET /availability` with query `resource=R1`, `start=40`, `end=50`, answered 500.

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

Expected: the preview line reads "R2 [19,21) is available", in green (`#166534` on `#ECF7F0`). The dashed green box from 19 to 21 is on the R2 row. The R1 row shows no preview box, and the bars "A [10,20)" and "B [20,30)" have no ring.

---

### S07. With empty fields the line asks for an interval and no check is sent

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the bars "A [10,20)" and "B [20,30)" on the R1 row.
2. Leave "Start" and "End" empty.
3. Read `requests` from `GET http://127.0.0.1:4010/__runbooks/state`.

Expected: the preview line reads "Pick a start and an end from 0 to 100", in gray (`#3A404C` on `#F1F3F6`). The timeline shows no dashed preview box and no ring. The "Book" button is disabled. `requests` holds `GET /resources` and `GET /bookings`, and no `GET /availability`.

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

Expected: the preview line reads "Pick a start and an end from 0 to 100", in gray (`#3A404C` on `#F1F3F6`). The dashed orange box is gone from the R1 row and the bars "A [10,20)" and "B [20,30)" no longer have a ring. The "Book" button is disabled. `requests` holds one `GET /availability`, with query `resource=R1`, `start=19`, `end=21`, and none with `end=101`.

---

## Not covered

- What the API saves, and that the check writes nothing in the database: a mocked runbook proves only what the screen shows and the requests it sends (S03 checks that no `POST` went out). The `bookings.check-availability` api runbook proves the API side against Postgres.
- The booking rules behind each answer (half-open `[start, end)`, only active bookings of the same resource conflict, conflicts in ascending id order): the API decides them and the page shows its answer as is. Proven by the `bookings.check-availability` api runbook.
- The debounce of about 250 ms and "only the latest answer counts" (`web/src/components/bookings/bookings-page.tsx:104-110`): timing. The mocked server answers at once, and a browser run cannot hold one response back so that it arrives after a newer one.
- The previous answer staying on screen while the answer for new fields is on its way (`bookings-page.tsx:117-118`): it lasts only the debounce plus one round trip, too short to observe reliably.
- The preview running again after a Book, turning "R1 [19,21) is available" into "R1 [19,21) conflicts with D" (`bookings-page.tsx:114`, `bookings` in the effect's dependencies): the fixtures answer one response per query within a step, so the switch cannot be replayed in a mocked step. Booking itself is `bookings.book-from-form`.
- Decimals and negative values ("2.5", "-1") in "Start" or "End": the same `isBookable` branch as S08 (`web/src/lib/bookings.ts:22-24`), so S08 stands for them.

---

## Cleanup

- None for a mocked run: nothing is written.
- After recording, the dev `booking` table holds A and B. Their ids are never reused, so the person who recorded decides whether to empty the table again.
