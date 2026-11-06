---
id: bookings.view-home
title: Open the bookings page and see every resource and booking
capability: bookings
surface: ui
feature: home
tags: []
roles: []
upstream: mocked
covers:
  entries: ["/", "GET /resources", "GET /bookings"]
  requirements: ["SCH-10#AC1", "SCH-18#AC1", "SCH-18#AC2", "SCH-18#AC3", "SCH-18#AC4"]
sources: ["map a93f56d", "docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "SCH-10", "SCH-16", "SCH-18"]
scripts: []
status: active
last_run:
  date: 2026-11-06
  oldest: 2026-11-06
  commit: "137e1bd"
  result: passed
  report: _runs/2026-11-06-0122-bookings.view-home.md
  runs:
    r1: { date: 2026-11-06, commit: "137e1bd", report: _runs/2026-11-06-0122-bookings.view-home.md }
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

# Open the bookings page and see every resource and booking

---

## Goal

A user opens the app and sees the five resources and every booking, active and canceled, on the Timeline and in the Bookings table, and can filter the table by status. A Timeline bar whose label does not fit ends it with an ellipsis, and hovering a bar lifts it slightly and shows its full label above the bars around it. When the API cannot be reached on load, the page says so, offers Retry and keeps the form disabled.

---

## Preconditions

- Services: the project's upstream server, `npm run runbooks:upstream` (it listens on `http://127.0.0.1:4010`), and the web app started against it, `NEXT_PUBLIC_API_URL=http://127.0.0.1:4010 npm run dev:web`, at `http://localhost:3000`. The API and Postgres are needed only to record the fixtures.
- Accounts: none. Authentication is out of scope (PRD).
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/view-home/`.
  - Runbook folder: `GET /resources` (R1 to R5 from the migration seed), recorded from S01, and `GET /bookings`, the S01 recording with B's start changed to 80 and its end changed to 100 by hand for SCH-16. Every step without a folder of its own gets these two answers.
  - `S04/get--bookings.json`: hand-written, `GET /bookings` answers A [10,40) active, B [90,130) active and C [20,50) canceled. B is a booking stored before the bookable window existed, which `POST /bookings` can no longer create.
  - `S07/get--bookings.json`: hand-written, `GET /bookings` answers `[]`.
  - `S08/get--bookings.json`: hand-written, `GET /bookings` answers 500.
  - `S10/get--bookings.json`: hand-written, `GET /bookings` answers A (R1 · Agora Room, [10,40), active), B (R2 · Pixel Room, [90,100), active) and C (R1 · Agora Room, [20,50), canceled), in that order. B is a 10-unit bar, too narrow for its label at 1280 by 720.
- Recording: with `docker compose up -d db` and `npm run dev:api` running and the `booking` table empty, create these bookings through the API, in this order:
  1. `POST /bookings` `{"id":"C","resource":"R1","start":20,"end":50}`
  2. `POST /bookings/C/cancel`
  3. `POST /bookings` `{"id":"A","resource":"R1","start":10,"end":40}`
  4. `POST /bookings` `{"id":"B","resource":"R2","start":80,"end":100}`

  `GET /bookings` then answers A (R1 · Agora Room, [10,40), active), B (R2 · Pixel Room, [80,100), active), C (R1 · Agora Room, [20,50), canceled), in that order. Then run `/runbooks:run bookings.view-home --record --steps S01`. Record S01 only: S02, S03, S05, S06 and S09 send no request of their own beyond S01's two. S04, S07, S08 and S10 have their own folders, and in `record` mode the server proxies every request, so recording any of them would replace its hand-written fixture with the live list.
- S09 starts on the screen S08 leaves. A script reproduces it by selecting step S08, opening `/`, waiting for "Retry", then selecting S09 before it clicks "Retry".

---

## Steps

### S01. Opening the page loads the five resources into the form and the Timeline

Parents: none
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Open `http://localhost:3000/`.
2. Wait until the "Timeline" card shows.

Expected: the page heading reads "Bookings".
- Operation card, titled "Operation": the "Id" field is empty; the "Resource" select offers "R1 · Agora Room", "R2 · Pixel Room", "R3 · 4K Projector", "R4 · Orbit Room", "R5 · Focus Room", in that order, with "R1 · Agora Room" selected; the "Start" and "End" fields are empty; the preview line reads "Pick a start and an end from 0 to 100"; the "Book" button is disabled; no result card shows (no `role="status"` element).
- Timeline card, titled "Timeline": the legend reads "Active", "Canceled", "Preview: available", "Preview: conflict"; there are five rows labelled "R1 · Agora Room", "R2 · Pixel Room", "R3 · 4K Projector", "R4 · Orbit Room", "R5 · Focus Room", in that order.
- Operation log card, titled "Operation log": it lists no entry (the loads are not logged).
- `requests` in `GET /__runbooks/state` holds only `GET /resources` and `GET /bookings`: no `GET /availability` and no `POST`.

---

### S02. The Bookings table lists every booking in the order the API returns, with its status

Parents: S01
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Look at the "Bookings" card below the Timeline.

Expected: the card is titled "Bookings". Its chips read "All (3)", "Active (2)" and "Canceled (1)"; "All (3)" is pressed (`aria-pressed="true"`, dark fill) and the other two are not. The column headers are ID, Resource, Interval, Status and Action, shown in uppercase. The rows, in this order:

| ID | Resource | Interval | Status | Action |
|---|---|---|---|---|
| A | R1 · Agora Room | [10,40) | Active | a "Cancel" button named "Cancel booking A" |
| B | R2 · Pixel Room | [80,100) | Active | a "Cancel" button named "Cancel booking B" |
| C | R1 · Agora Room | [20,50) | Canceled | empty: no button, no text |

The text "No bookings in this filter." does not show.

---

### S03. The Timeline draws each booking on its resource's row, the canceled one under the active one until it is hovered

Parents: S01
Requirement: SCH-10#AC1, SCH-18#AC3
Page: `/`

Actions:

1. Look at the rows of the "Timeline" card.
2. Hover each bar to read its tooltip.
3. Move the pointer off the bars, then onto bar C's visible end on the R1 · Agora Room row: a point between 40 and 50 on the axis, right of bar A's end (for example at 45). Bar C's center, at 35, sits under bar A, so hovering C by its center hovers A.

Expected:
- R1 · Agora Room row: an active bar with the text "A [10,40)" (blue fill, white text, tooltip "Booking A · [10,40) · active") and a canceled bar with the text "C [20,50)" (light gray fill, dashed gray border, struck-through gray text, tooltip "Booking C · [20,50) · canceled"). Where they overlap, from 20 to 40, bar A is drawn over bar C, so C's label, which starts at 20, is hidden: `document.elementFromPoint` at the center of C's label returns bar A or its label, not bar C. Only C's empty end, from 40 to 50, shows. The text "C [20,50)" is still in the page text.
- R2 · Pixel Room row: an active bar with the text "B [80,100)", tooltip "Booking B · [80,100) · active".
- R3 · 4K Projector, R4 · Orbit Room and R5 · Focus Room rows: no bar.
- No dashed preview box shows on any row.
- After action 3, while the pointer rests on C's visible end: bar C is drawn above bar A and its full label "C [20,50)" shows, struck through (`document.elementFromPoint` at the center of C's label now returns bar C or its label). Bar C keeps its start at 20 and its end at 50. Bar C sits 2px higher than at rest: once the 150ms transition settles, its bounding top is 2px less than before the hover. Moving the pointer off bar C draws bar A over it again and returns bar C to its rest position: its bounding top is the same as before the hover.

---

### S04. The Timeline axis stretches past 100 to fit a booking stored before the bookable window existed

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `http://localhost:3000/`.
2. Wait until the "Timeline" card shows.
3. Look at the tick labels above the Timeline rows.

Expected: the tick labels read "0", "25", "50", "75", "100", "125", left to right. Bar "B [90,130)" ends at the right edge of the R2 track, because the axis runs from 0 to 130.

---

### S05. The Active chip shows only the active bookings

Parents: S02
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Click "Active (2)".

Expected: "Active (2)" is pressed and "All (3)" and "Canceled (1)" are not. The chip counts stay "All (3)", "Active (2)", "Canceled (1)". The table shows rows A and B only, in that order, each with Status "Active" and its "Cancel" button. The Timeline still shows bars A, B and C.

---

### S06. The Canceled chip shows only the canceled bookings, with no Cancel button

Parents: S02
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Click "Canceled (1)".

Expected: "Canceled (1)" is pressed and "All (3)" and "Active (2)" are not. The table shows row C only: R1 · Agora Room, [20,50), Status "Canceled", and an empty Action cell (no button, no text). The Timeline still shows bars A, B and C.

---

### S07. With no bookings, the table says so and the Timeline rows stay empty

Parents: none
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Open `http://localhost:3000/`.
2. Wait until the "Timeline" card shows.

Expected: the chips read "All (0)", "Active (0)" and "Canceled (0)", with "All (0)" pressed. The table shows its headers and no row, and below them the text "No bookings in this filter.". The Timeline shows the five rows "R1 · Agora Room" to "R5 · Focus Room" with no bar, and the tick labels read "0", "20", "40", "60", "80", "100". The "Resource" select shows "R1 · Agora Room" and is enabled.

---

### S08. When the bookings cannot load, an error panel replaces the Timeline and the table, and the form is disabled

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `http://localhost:3000/`.
2. Wait until the "Retry" button shows.

Expected: in place of the Timeline and Bookings cards, a panel (`role="alert"`) reads "Can't reach the API at http://127.0.0.1:4010. Start it with npm run dev:api." and has a "Retry" button. The URL in it is the `NEXT_PUBLIC_API_URL` the app was started with. No "Timeline" card and no "Bookings" table card show; the page heading "Bookings" stays. In the Operation card, the "Id", "Resource", "Start" and "End" controls are disabled, the "Resource" select has no option, the preview line reads "Pick a start and an end from 0 to 100", and "Book" is disabled. The "Operation log" card shows, with no entry. `requests` in `GET /__runbooks/state` holds `GET /resources` and `GET /bookings`.

---

### S09. Retry loads the page once the API answers

Parents: S08
Requirement: SCH-10#AC1
Page: `/`

Actions:

1. Keep the page S08 left open, with the error panel on screen. Do not reload.
2. Click "Retry".

Expected: the error panel is gone. The Timeline shows the five resource rows with bars A, B and C, and the Bookings table shows the chips "All (3)", "Active (2)", "Canceled (1)" and rows A, B and C, as in S02. The "Resource" select is enabled and shows "R1 · Agora Room"; "Id", "Start" and "End" are enabled and empty; "Book" stays disabled because Start and End are empty. `requests` in `GET /__runbooks/state` holds `GET /resources` and `GET /bookings`, sent by the click.

---

### S10. A bar too narrow for its label ends it with an ellipsis and shows it in full on hover

Parents: none
Requirement: SCH-18#AC1, SCH-18#AC2, SCH-18#AC3
Page: `/`

Actions:

1. Set the browser viewport to 1280 by 720.
2. Open `http://localhost:3000/`.
3. Wait until the "Timeline" card shows.
4. Look at bar B on the R2 · Pixel Room row, then read its tooltip.
5. Hover bar B.

Expected:
- Before the hover: bar B, the active bar on the R2 · Pixel Room row, is too narrow for its label, and its visible label ends with "…". The label element inside the bar (the `span` that holds "B [90,100)") has a `scrollWidth` greater than its `clientWidth`, and its computed `text-overflow` is `ellipsis`. The page text still holds the full label "B [90,100)". The tooltip reads "Booking B · [90,100) · active".
- While the pointer rests on bar B: the bar widens to show its full label "B [90,100)", with no ellipsis (the label element's `scrollWidth` is no greater than its `clientWidth`), and is drawn above the bars next to it. Its right edge stays at the right end of the R2 track, and its left edge stays inside the track: the bar widens to the left. Bar B sits 2px higher than at rest: once the 150ms transition settles, its bounding top is 2px less than before the hover.
- After moving the pointer off bar B: it returns to its rest position: its bounding top is the same as before the hover.

---

## Not covered

- What the API stores and the order it returns: this runbook is mocked, so it proves only what the page shows from the fixtures. The list and its ascending id order are proven by the `api` runbooks `bookings.list-bookings` and `resources.list-resources`.
- Persistence after a reload: the flow saves nothing. The filter lives in the page's memory only.
- A failed `GET /resources`, a `200` whose body is not a list, and an API that does not answer at all: the page takes the same branch as S08 for each (`fetchAll` returns `null`, `web/src/components/bookings/bookings-page.tsx:33-37`), so S08 stands for them. A mocked server always answers, so the unreachable case cannot be produced here.
- A Retry that fails again: the same branch as S08's first load.
- The loading state between opening the page and the two answers (form disabled, Timeline and table empty): mocked answers arrive at once, so no step can hold it.
- Book, the live preview, Cancel, the result card, log entries and pending rows at 50% opacity: covered by `bookings.book-from-form`, `bookings.preview-availability` and `bookings.cancel-from-table`.
- Colors, sizes and spacing beyond the states named in the steps: the config has no design reference.
- A canceled bar that lies entirely under an active bar: no part of it can be hovered, so its label never shows on the Timeline. It stays in the page text, in the bar's tooltip and in the Bookings table.
- A bar too narrow to show even the ellipsis: it shows no text, and none of the fixtures holds a bar that narrow at 1280 by 720.
- Keyboard focus on a bar: it does not expand the bar (SCH-18), and bars are not in the tab order, so no step can focus one.
- The motion of the hover lift: the steps check only the settled 2px offset, not the 150ms easing (`transition-transform duration-150`, `web/src/components/bookings/timeline.tsx:77`) frame by frame, and not the reduced-motion case, where `motion-reduce:transition-none` applies the lift with no transition.

---

## Cleanup

- A mocked run writes nothing.
- The recording leaves bookings A, B and C in the dev `booking` table, and their ids stay taken. Emptying the table again is a manual step for the person who records.
