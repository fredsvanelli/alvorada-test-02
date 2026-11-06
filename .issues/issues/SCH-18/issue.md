---
id: SCH-18
title: Show Timeline bar text when a bar is narrow or sits under another bar
type: bug
status: backlog
related: [SCH-16]
created: 2026-11-06T02:17:39.571Z
updated: 2026-11-06T02:17:48Z
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
