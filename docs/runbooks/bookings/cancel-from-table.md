---
id: bookings.cancel-from-table
title: Cancel an active booking from the Bookings table
capability: bookings
surface: ui
feature: cancel-from-table
tags: []
roles: []
upstream: mocked
covers:
  entries: ["/", "GET /resources", "GET /bookings", "POST /bookings/{id}/cancel"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-05-sch-10-web-ui-design.md", "SCH-10", "text \"Cancel in the Bookings table opens a confirmation dialog: Keep booking or Escape closes it and sends nothing, Cancel booking closes it and sends the cancel followed by GET /bookings\"", "SCH-19", "diff main...5269ad5", "text \"SCH-19 follow-up: the Operation log no longer logs GET /resources, GET /bookings (page load, Retry) nor the GET /bookings re-fetch after a write; it logs only the calls a user action sends: POST /bookings, POST /bookings/:id/cancel and each GET /availability the live preview sends\""]
scripts: ["web/e2e/bookings/cancel-from-table.runbook.spec.ts"]
status: active
last_run:
  date: 2026-11-06
  oldest: 2026-11-06
  commit: "5269ad5"
  result: passed
  report: _runs/2026-11-06-0234-bookings.cancel-from-table.md
  runs:
    r1: { date: 2026-11-06, commit: "5269ad5", report: _runs/2026-11-06-0234-bookings.cancel-from-table.md }
  cells:
    S01: passed r1
    S09: passed r1
    S10: passed r1
    S11: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
    S08: passed r1
---

# Cancel an active booking from the Bookings table

---

## Goal

On the bookings home page, a user presses Cancel on an active booking in the Bookings table. A confirmation dialog asks first: "Keep booking" or Escape closes it and sends nothing, and "Cancel booking" confirms. On confirm the page sends the cancel, re-fetches the list, and shows the booking as Canceled in the table and on the timeline. The result card says it was canceled and that its id stays taken, and the row no longer offers Cancel. The Operation log shows only the calls a user action sends: the cancel, added when its reply arrives. The page load and the re-fetch are not logged.

---

## Preconditions

- Services: the web app (`npm run dev:web`, http://localhost:3000) started with `NEXT_PUBLIC_API_URL` pointing at the upstream server (`npm run runbooks:upstream`, `web/e2e/runbooks-upstream.mjs`), with this runbook selected in `mocked` mode.
- Accounts: none. Authentication is out of scope (PRD).
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/cancel-from-table/`. They hold the resources R1 to R5 (R1 "Agora Room", R2 "Pixel Room") and two active bookings: A on R1 `[10,20)` and B on R2 `[30,40)`. After the cancel in S02, `GET /bookings` answers with A `canceled` and B still `active`.
- Recording (`/runbooks:run bookings.cancel-from-table --record` only): start from an empty `booking` table in the dev database, emptied only after the user approves it. Before S01, create the two bookings with `POST /bookings` sent straight to the API at `http://localhost:3001` (not through the upstream server, so the creates are not recorded): `{"id":"A","resource":"R1","start":10,"end":20}` and then `{"id":"B","resource":"R2","start":30,"end":40}`. Each one must return 201. Nothing else may be in the table.
- Step order: S01, then S09, S10 and S11 (the confirmation dialog, which sends no request), then S02 and S03 to S08. All of them run on the page S01 left open, without a reload or navigation. `GET /bookings` answers differently before the cancel (S01) and after it (S02), so the page has to load under S01 and the confirmed cancel has to happen with S02 selected. Steps S09 to S11 leave A active and the dialog closed, as S01 left it. Steps S03 to S08 send no request: they read the screen S02 left.
- The Id, Start and End fields stay empty for the whole run, so the page sends no `GET /availability`.

---

## Steps

### S01. Before the cancel, A is Active and offers Cancel

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the Bookings table to show two rows.

Expected: the Bookings table header shows the chips "All (2)", "Active (2)" and "Canceled (0)", with "All (2)" pressed (`aria-pressed="true"`). The rows are, in this order:

- ID "A", Resource "R1 · Agora Room", Interval "[10,20)", Status badge "Active", and a "Cancel" button labelled "Cancel booking A" (enabled) in the Action cell.
- ID "B", Resource "R2 · Pixel Room", Interval "[30,40)", Status badge "Active", and a "Cancel" button labelled "Cancel booking B" (enabled).

On the Timeline, the R1 row has an active bar (solid blue, white text) reading "A [10,20)" with the tooltip "Booking A · [10,20) · active". No result card (`role="status"`) is shown under Book.

The Operation log has no entries: the page load (`GET /resources` and `GET /bookings`) is not logged.

---

### S09. Pressing Cancel opens a confirmation dialog and sends nothing

Parents: S01
Requirement: none
Page: `/`

Actions:

1. On the page S01 left open (no reload), click the "Cancel" button labelled "Cancel booking A".

Expected: a confirmation dialog (`role="alertdialog"`) opens over the page. Its title is "Cancel booking A?" and its description is "R1 [10,20) becomes free. The id A stays taken.". It has two buttons, "Keep booking" (outlined) and "Cancel booking" (red text on a light red background). `GET /__runbooks/state` lists no request in `requests` since S09 was selected, and `unmatched` is empty. No result card is shown under Book, and the Operation log still has no entries.

---

### S10. Keep booking closes the dialog and sends nothing

Parents: S09
Requirement: none
Page: `/`

Actions:

1. With the dialog S09 opened, click "Keep booking".

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists no request in `requests` since S10 was selected, and `unmatched` is empty. Row A still shows the Status badge "Active" and the enabled "Cancel" button labelled "Cancel booking A". No result card is shown under Book, and the Operation log still has no entries.

---

### S11. Escape closes the dialog and sends nothing

Parents: S09
Requirement: none
Page: `/`

Actions:

1. Without reloading, click the "Cancel" button labelled "Cancel booking A". The dialog "Cancel booking A?" opens.
2. Press Escape.

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists no request in `requests` since S11 was selected, and `unmatched` is empty. Row A still shows the Status badge "Active" and the enabled "Cancel" button labelled "Cancel booking A". No result card is shown under Book, and the Operation log still has no entries.

---

### S02. Confirming in the dialog sends the cancel for A, then re-fetches the list

Parents: S09
Requirement: none
Page: `/`

Actions:

1. On the page S01 left open (no reload), click the "Cancel" button labelled "Cancel booking A". The dialog "Cancel booking A?" opens.
2. In the dialog, click "Cancel booking".
3. Wait until the result card (`role="status"`) appears under Book.

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists in `requests` exactly two requests since S02 was selected, in this order:

1. `POST /bookings/A/cancel` with no body, status 200.
2. `GET /bookings`, status 200.

No `POST /bookings`, no `GET /availability` and no second cancel was sent. `unmatched` is empty.

---

### S03. The result card says A was canceled and its id stays taken

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Look at the result card under Book, without reloading.

Expected: the result card (`role="status"`, green "ok" palette) shows the code chip "canceled", the title "Booking A canceled" and the detail line "Its id stays taken.".

---

### S04. A's row turns Canceled and no longer offers Cancel

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Look at row A in the Bookings table, without reloading.

Expected: row A still shows ID "A", Resource "R1 · Agora Room" and Interval "[10,20)", now with the Status badge "Canceled" (grey). Its Action cell is empty: no "Cancel booking A" button and no text. The row is at full opacity, not the 50% of a pending entry. Row A is still the first row and row B the second, as the API returned them.

---

### S05. A's timeline bar turns Canceled

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Look at the R1 row of the Timeline, without reloading.

Expected: the R1 row shows a canceled bar reading "A [10,20)": light grey background, dashed grey border, grey struck-through text (line-through). Its tooltip is "Booking A · [10,20) · canceled". The bar stays at the same position and width it had in S01.

---

### S06. The Operation log records only the cancel, with the API's answer

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Look at the Operation log, without reloading.

Expected: the log has exactly one entry: the re-fetch `GET /bookings` S02 sent is not logged. Its first line is "#1" followed by `POST /bookings/A/cancel`. It has no request block (the cancel has no body). Under it, indented and in the green "ok" color, `→ 200` on its own line, then the reply JSON on indented lines (2-space indents):

```text
→ 200
{
  "result": "canceled",
  "booking": {
    "id": "A",
    "resource": {
      "id": "R1",
      "name": "Agora Room"
    },
    "start": 10,
    "end": 20,
    "status": "canceled"
  }
}
```

---

### S07. The filter chips count A as Canceled, and the Canceled filter shows it

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Without reloading, read the filter chips in the Bookings table header.
2. Click "Canceled (1)".

Expected: before the click the chips read "All (2)", "Active (1)" and "Canceled (1)". After the click, "Canceled (1)" is pressed (`aria-pressed="true"`) and the table shows a single row: ID "A", Resource "R1 · Agora Room", Interval "[10,20)", Status badge "Canceled", and an empty Action cell. "No bookings in this filter." does not appear.

---

### S08. The other booking is untouched

Parents: S02
Requirement: none
Page: `/`

Actions:

1. Without reloading, click "Active (1)" in the Bookings table header.

Expected: "Active (1)" is pressed and the table shows a single row: ID "B", Resource "R2 · Pixel Room", Interval "[30,40)", Status badge "Active", with the enabled "Cancel" button labelled "Cancel booking B". On the Timeline, the R2 row still shows the active bar "B [30,40)" with the tooltip "Booking B · [30,40) · active".

---

## Not covered

- Canceling an already canceled booking (`already_canceled`, warning card "Booking A was already canceled" / "Nothing changed.") and canceling an id that does not exist (`not_found`, card "Booking not found"): this UI cannot reach them. A Canceled row has no Cancel button and there is no cancel-by-id, so a second cancel is possible only from a stale row (canceled in another tab or by curl). This was a deliberate departure from the issue ("Departures from the issue" in the spec). The API behavior is proven by the api runbook `bookings.cancel-booking` (S02 and S03), and the card mapping by the `cancelResult` unit test in `web/src/lib/bookings.test.ts`.
- The in-flight state: while the cancel request is pending, row A and its bar are at 50% opacity and its Cancel button is disabled (`bookings-table.tsx`, `timeline.tsx`, `applyOptimistic` in `web/src/lib/bookings.ts`). The mocked server answers at once, and a fixture has no delay, so the state lasts too short for the browser to observe it reliably. The `applyOptimistic` unit test covers the state change.
- A failed cancel (network error, a 5xx or a body outside the contract), which shows the "Request failed" card, and a failed re-fetch, which keeps the last good list (`bookings-page.tsx`, `write`): the fixtures are recorded from the live API, which cannot fail on demand. A hand-written 500 fixture in a step folder would be overwritten by the next `--record` pass. It can be added with `/runbooks:update` once the fixtures are recorded.
- That the cancel was saved (A stays canceled after a reload, and its id stays taken): this runbook is `mocked`, so it proves the request in S02 and what the screen shows, never what the API saves. The api runbook `bookings.cancel-booking` S01 proves the row is kept with `status: canceled`.
- The Operation log's limits: it keeps the latest 30 entries while the numbers keep counting up, and past 640px its entries scroll inside the panel. This flow adds one entry, so it reaches neither. The cap is covered by the `addLog` unit test in `web/src/lib/bookings.test.ts`. A failed cancel would show in red (its entry takes the tone of the result card, `cancelResult` in the same file), but the fixtures cannot fail, as the item above says.
- The availability preview re-running after the re-fetch (an interval freed by the cancel turning "available"): it belongs to the live preview flow, `bookings.preview-availability`.

---

## Cleanup

- Mocked runs: nothing. The upstream server answers from the fixtures, and no booking is created.
- After a recording: A (canceled) and B stay in the dev `booking` table. A created id is never reused, so another recording needs the table emptied again, and only after the user approves it.
