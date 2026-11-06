---
id: SCH-18
title: Show Timeline bar text when a bar is narrow or sits under another bar
type: bug
status: done
estimate: 2
assignee: fred-vanelli
related: [SCH-16]
branch: sch-18-show-timeline-bar-text-when-a-bar-is
created: 2026-11-06T02:17:39.571Z
updated: 2026-11-06T06:12:31Z
---

## Description

### Context

Timeline bars can hide their text. Both cases were seen in a browser during SCH-16, at 1280 by 720:

- A narrow bar clips its text with no visible ellipsis. A 10-unit bar is about 66 px wide, so `B [90,100)` showed as `B [90,10`.
- A canceled bar's text can sit under an active bar. With A `[10,40)` active and C `[20,50)` canceled on one resource, C's text does not show, and only its empty end from 40 to 50 is visible.

In both cases the full text stays in the page and in the bar's tooltip.

### Scope (in)

- Decide how a bar shows a label that does not fit, and how an overlapped canceled bar shows its label.
- Update the `bookings.view-home` runbook, whose S03 only checks the text in the page and not that it is visible.
- Hovering the time card shows a (x) round icon that allows the user to cancel, with confirmation modal

## Acceptance criteria

- [ ] At 1280 by 720, a Timeline bar whose label does not fit shows a visible sign that it is cut (for example an ellipsis), never a label cut mid-character with no sign. A 10-unit bar such as `B [90,100)` is the reference case. A bar too narrow to show even the ellipsis shows no text.
- [ ] Every bar keeps its full label in the page text and in its tooltip (`Booking <id> · [start,end) · <status>`).
- [ ] Hovering a Timeline bar widens it to the smallest width that shows its full label, drawn above the bars next to it. A bar that starts past the middle of the axis keeps its right edge and widens to the left, so `B [90,100)` stays inside the track. Keyboard focus does not expand a bar.
- [ ] The `bookings.view-home` runbook checks that a narrow bar's label is visibly cut with an ellipsis and that hovering it shows the full label inside the track (a new step S10 with `B [90,100)`), and records in S03 that an active bar is drawn over an overlapped canceled bar, hiding the canceled bar's label there until its visible part is hovered. The runbook passes in the browser at 1280 by 720.
