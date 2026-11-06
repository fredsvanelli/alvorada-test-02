---
id: bookings.cancel-from-timeline
title: Cancel an active booking from its Timeline bar
capability: bookings
surface: ui
feature: cancel-from-timeline
tags: []
roles: []
upstream: mocked
covers:
  entries: ["/", "GET /resources", "GET /bookings", "POST /bookings/{id}/cancel"]
  requirements: []
sources: ["SCH-20", ".issues/issues/SCH-20/issue.md", "text \"SCH-20: on the bookings home page, hovering an active, non-pending Timeline bar shows, besides its full label, a round (x) button inside the blue bar at its right end (accessible name 'Cancel booking <id> from the Timeline'). Without the pointer on the bar the (x) is not shown (display none, so it takes no space and labels truncate as before). Canceled bars and bars with a cancel or a create in flight show no (x). Clicking the (x) opens the same confirmation dialog as the table Cancel: title 'Cancel booking <id>?', text '<resource id> <interval> becomes free. The id <id> stays taken.', buttons 'Keep booking' and 'Cancel booking'. 'Keep booking' or Escape closes it and sends nothing. 'Cancel booking' closes it and cancels exactly like the table Cancel: POST /bookings/<id>/cancel then GET /bookings; the bar and the table row turn Canceled, the result card says it was canceled and the id stays taken, and the Operation log shows only the cancel. Clicking the bar itself does nothing. Keyboard and touch access to the (x) are out of scope (the table Cancel covers them). No API change.\""]
scripts: ["web/e2e/bookings/cancel-from-timeline.runbook.spec.ts"]
status: active
last_run:
  date: 2026-11-06
  oldest: 2026-11-06
  commit: "35b4bfb"
  result: passed
  report: _runs/2026-11-06-0356-bookings.cancel-from-timeline.md
  runs:
    r1: { date: 2026-11-06, commit: "35b4bfb", report: _runs/2026-11-06-0356-bookings.cancel-from-timeline.md }
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
    S11: passed r1
    S12: passed r1
---

# Cancel an active booking from its Timeline bar

---

## Goal

On the bookings home page, a user hovers an active booking's bar on the Timeline. Besides widening to show its full label, the bar shows a round (x) button at its right end, inside the blue bar. The (x) is hidden whenever the pointer is off the bar, and canceled bars never show one. Clicking the (x) opens the same confirmation dialog as Cancel in the Bookings table. "Keep booking" or Escape closes it and sends nothing. "Cancel booking" cancels exactly like the table: the page sends the cancel, re-fetches the list, and shows the booking as Canceled on the Timeline and in the table. The result card says it was canceled and that its id stays taken, and the Operation log shows only the cancel. Clicking the bar itself, outside the (x), does nothing.

---

## Preconditions

- Services: the web app (`npm run dev:web`, http://localhost:3000) started with `NEXT_PUBLIC_API_URL` pointing at the upstream server (`npm run runbooks:upstream`, `web/e2e/runbooks-upstream.mjs`), with this runbook selected in `mocked` mode.
- Accounts: none. Authentication is out of scope (PRD).
- Data: the fixtures in `docs/runbooks/_fixtures/bookings/cancel-from-timeline/`. They hold the resources R1 to R5 (R1 "Agora Room", R2 "Pixel Room", R3 "4K Projector") and three bookings: A active on R1 `[10,20)`, B active on R2 `[30,40)` and C canceled on R3 `[50,60)`. The latest end is 60, so the Timeline axis runs from 0 to 100. After the cancel in S07, `GET /bookings` answers with A `canceled`, B still `active` and C still `canceled` (`S07/get--bookings.json`). The fixtures are hand-written from `api/openapi.yaml` and the recordings of `bookings.cancel-from-table`, since SCH-20 changes no API.
- Pointer: a mouse pointer. "Hover a bar" means resting the pointer on the bar's label, away from where the (x) appears. "Move the pointer off" means resting it on the "Timeline" heading, outside every bar.
- Step order: S01 to S12 in order, all on the page S01 left open, without a reload or navigation. `GET /bookings` answers differently before the cancel (S01) and after it (S07), so the page has to load under S01 and the confirmed cancel has to happen with S07 selected. S02 to S06 leave A active and the dialog closed. S08 to S12 read the screen S07 left, and send no request.
- The Id, Start and End fields stay empty for the whole run, so the page sends no `GET /availability`.

---

## Steps

### S01. Hovering an active bar shows its full label and the (x) at its right end

Parents: none
Requirement: none
Page: `/`

Actions:

1. Open `/` and wait for the Bookings table to show three rows (A, B, C).
2. Without moving the pointer onto the Timeline, read bar A on the R1 · Agora Room row.
3. Hover bar A.

Expected:

- Before the hover: bar A is an active bar (solid blue, white text) with the tooltip "Booking A · [10,20) · active", at left 10% with width 10% of the R1 track. It is too narrow for its label: the label element (the `span` that holds "A [10,20)") has a `scrollWidth` greater than its `clientWidth` and ends with "…" (computed `text-overflow: ellipsis`). The page has no visible button named "Cancel booking A from the Timeline": the button exists inside bar A, after the label, with computed `display: none`. The label fills the bar's content box, from the left padding to the right padding: its right edge is 9px (1px border plus 8px padding) left of the bar's right edge.
- While the pointer rests on bar A: the bar widens to the right (its left edge stays at 10% of the track) and shows its full label "A [10,20)" with no ellipsis (the label's `scrollWidth` is no greater than its `clientWidth`). After the label, inside the blue bar, a button named "Cancel booking A from the Timeline" is visible: an 18px by 18px round button (`rounded-full`) with a translucent white background over the blue, holding one 12px by 12px (x) icon (`svg`). Its box lies entirely inside the bar's box, its left edge is at or right of the label's right edge, and its right edge is 9px (border plus padding) left of the bar's right edge: it sits at the bar's right end. The tooltip still reads "Booking A · [10,20) · active".
- Bar B on the R2 · Pixel Room row shows no (x) while A is hovered: its button named "Cancel booking B from the Timeline" has computed `display: none`.

---

### S02. Moving the pointer off the bar hides the (x)

Parents: S01
Requirement: none
Page: `/`

Actions:

1. With the pointer resting on bar A as S01 left it, move the pointer off the bar, onto the "Timeline" heading.

Expected: once the bar settles at rest, the (x) is hidden: the button inside bar A has computed `display: none`, and the page has no button named "Cancel booking A from the Timeline" in the accessibility tree. It takes no space: bar A is back at width 10% of the track, its label is truncated again with "…" (`scrollWidth` greater than `clientWidth`), and the label's right edge is again 9px left of the bar's right edge, as before the hover in S01.

---

### S03. A canceled bar shows no (x) on hover

Parents: S01
Requirement: none
Page: `/`

Actions:

1. Hover bar C on the R3 · 4K Projector row.

Expected: bar C is a canceled bar (light grey background, dashed grey border, grey struck-through text) with the tooltip "Booking C · [50,60) · canceled". While the pointer rests on it, it shows its full label "C [50,60)", struck through, with no ellipsis. Bar C holds no `button` element, and the page has no button named "Cancel booking C from the Timeline".

---

### S04. Clicking the (x) opens the table's confirmation dialog and sends nothing

Parents: S01
Requirement: none
Page: `/`

Actions:

1. Hover bar A.
2. Click the button named "Cancel booking A from the Timeline".

Expected: a confirmation dialog (`role="alertdialog"`) opens over the page. Its title is "Cancel booking A?" and its description is "R1 [10,20) becomes free. The id A stays taken.". It has exactly two buttons, in this order: "Keep booking" (outlined) and "Cancel booking" (red text on a light red background). These are the title, the text and the buttons the "Cancel" button labelled "Cancel booking A" in the Bookings table opens. `GET /__runbooks/state` lists no request in `requests` since S04 was selected, and `unmatched` is empty. No result card (`role="status"`) is shown under Book, and the Operation log has no entries.

---

### S05. Keep booking closes the dialog and sends nothing

Parents: S04
Requirement: none
Page: `/`

Actions:

1. With the dialog S04 opened, click "Keep booking".

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists no request in `requests` since S05 was selected, and `unmatched` is empty. Bar A is still an active bar (solid blue) with the tooltip "Booking A · [10,20) · active". Row A in the Bookings table still shows the Status badge "Active" and the enabled "Cancel" button labelled "Cancel booking A". No result card is shown under Book, and the Operation log still has no entries.

---

### S06. Escape closes the dialog and sends nothing

Parents: S04
Requirement: none
Page: `/`

Actions:

1. Without reloading, hover bar A and click the button named "Cancel booking A from the Timeline". The dialog "Cancel booking A?" opens.
2. Press Escape.

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists no request in `requests` since S06 was selected, and `unmatched` is empty. Bar A is still an active bar with the tooltip "Booking A · [10,20) · active". Row A still shows the Status badge "Active" and the enabled "Cancel" button labelled "Cancel booking A". No result card is shown under Book, and the Operation log still has no entries.

---

### S07. Confirming in the dialog sends the cancel for A, then re-fetches the list

Parents: S04
Requirement: none
Page: `/`

Actions:

1. Without reloading, hover bar A and click the button named "Cancel booking A from the Timeline". The dialog "Cancel booking A?" opens.
2. In the dialog, click "Cancel booking".
3. Wait until the result card (`role="status"`) appears under Book.

Expected: the dialog closes: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists in `requests` exactly two requests since S07 was selected, in this order:

1. `POST /bookings/A/cancel` with no body, status 200.
2. `GET /bookings`, status 200.

No `POST /bookings`, no `GET /availability` and no second cancel was sent. `unmatched` is empty.

---

### S08. A's bar turns Canceled in place and no longer shows the (x)

Parents: S07
Requirement: none
Page: `/`

Actions:

1. Without reloading, look at bar A on the R1 · Agora Room row.
2. Hover bar A.

Expected: bar A is a canceled bar reading "A [10,20)": light grey background, dashed grey border, grey struck-through text (line-through). Its tooltip is "Booking A · [10,20) · canceled". It stays at the same position and width it had in S01 (left 10%, width 10% of the track). It is at full opacity, not the 50% of a pending entry. While the pointer rests on it, it holds no `button` element, and the page has no button named "Cancel booking A from the Timeline".

---

### S09. A's row in the Bookings table turns Canceled and no longer offers Cancel

Parents: S07
Requirement: none
Page: `/`

Actions:

1. Look at row A in the Bookings table, without reloading.

Expected: row A still shows ID "A", Resource "R1 · Agora Room" and Interval "[10,20)", now with the Status badge "Canceled" (grey). Its Action cell is empty: no "Cancel booking A" button and no text. The row is at full opacity. The rows stay in the order the API returned them: A, B, C. The filter chips read "All (3)", "Active (1)" and "Canceled (2)".

---

### S10. The result card says A was canceled and its id stays taken

Parents: S07
Requirement: none
Page: `/`

Actions:

1. Look at the result card under Book, without reloading.

Expected: the result card (`role="status"`, green "ok" palette) shows the code chip "canceled", the title "Booking A canceled" and the detail line "Its id stays taken.".

---

### S11. The Operation log records only the cancel, with the API's answer

Parents: S07
Requirement: none
Page: `/`

Actions:

1. Look at the Operation log, without reloading.

Expected: the log has exactly one entry: the page load and the re-fetch `GET /bookings` S07 sent are not logged. Its first line is "#1" followed by `POST /bookings/A/cancel`. It has no request block (the cancel has no body). Under it, indented and in the green "ok" color, `→ 200` on its own line, then the reply JSON on indented lines (2-space indents):

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

### S12. Clicking an active bar outside the (x) does nothing

Parents: S01
Requirement: none
Page: `/`

Actions:

1. Without reloading, hover bar B on the R2 · Pixel Room row. Its (x), the button named "Cancel booking B from the Timeline", appears at the bar's right end.
2. Click the label "B [30,40)" inside bar B, away from the (x).

Expected: no dialog opens: no `role="alertdialog"` element is on the page. `GET /__runbooks/state` lists no request in `requests` since S12 was selected, and `unmatched` is empty. Bar B is still an active bar with the tooltip "Booking B · [30,40) · active", and row B in the Bookings table still shows the Status badge "Active" and the enabled "Cancel" button labelled "Cancel booking B". The result card and the Operation log are unchanged.

---

## Not covered

- The in-flight state: while a cancel or a create is pending, its bar is at 50% opacity and shows no (x) on hover (`b.pending` in `web/src/components/bookings/timeline.tsx`, `applyOptimistic` in `web/src/lib/bookings.ts`). The mocked server answers at once, and a fixture has no delay, so the state lasts too short for the browser to observe it reliably. The `applyOptimistic` unit test covers the state change, and `bookings.cancel-from-table` lists the same limit.
- Keyboard and touch access to the (x): out of scope (SCH-20). At rest the (x) has `display: none`, so Tab never reaches it, and a touch screen has no hover. The table's Cancel covers both, proven by `bookings.cancel-from-table`.
- Canceling an already canceled booking (`already_canceled`) and a booking that does not exist (`not_found`) from the Timeline: a canceled bar has no (x) (S03, S08), so this UI cannot send either. The api runbook `bookings.cancel-booking` proves the API behavior.
- A failed cancel (network error, a 5xx or a body outside the contract), which shows the "Request failed" card, and a failed re-fetch, which keeps the last good list: they go through the same `onCancel` and `write` as the table's Cancel (`web/src/components/bookings/bookings-page.tsx`), which `bookings.cancel-from-table` lists under its Not covered with the same reason. This runbook adds no path of its own there.
- That the cancel was saved (A stays canceled after a reload, and its id stays taken): this runbook is `mocked`, so it proves the request in S07 and what the screen shows, never what the API saves. The api runbook `bookings.cancel-booking` S01 proves the row is kept with `status: canceled`.
- The hover motion itself (the 2px lift, the 150ms transition and drawing the hovered bar above its neighbors) and a canceled bar hidden under an active one: they belong to `bookings.view-home` (S03, S10).
- The (x)'s hover shade (`bg-white/35` on hover of the (x) itself, over `bg-white/20`): a color the steps do not compare, since the computed value of a Tailwind opacity color is not a stable string to quote.

---

## Cleanup

- Nothing. The upstream server answers from the fixtures, and no booking is created.
