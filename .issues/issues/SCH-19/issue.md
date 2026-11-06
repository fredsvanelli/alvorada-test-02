---
id: SCH-19
title: "Show every API call in the Operation log, with multiline JSON and a taller scrolling panel"
type: feature
status: in_progress
priority: medium
estimate: 3
assignee: fred-vanelli
branch: sch-19-show-every-api-call-in-the-operation-log
created: 2026-11-06T02:31:26.860Z
updated: 2026-11-06T04:52:42Z
---

## Description

### Context

The Operation log shows how the page talks to the API during a demo, but it records only the Book and Cancel POSTs. The page also sends `GET /resources`, `GET /bookings` and `GET /availability`, and the log leaves those out. JSON bodies print on one line, so long replies are hard to read. The panel has no height limit and keeps the last 14 entries. Once every call is logged, the preview checks of a single booking would fill those 14 entries.

### Scope (in)

- Log every API call the bookings page sends: Book, Cancel, `GET /resources` and `GET /bookings` (page load, Retry, the re-fetch after a write), and `GET /availability` (live preview)
- Print JSON request and response bodies on multiple indented lines
- Let the panel grow with its entries up to a max height of 640px, then scroll inside the panel
- Keep the last 30 entries, with the newest on top
- Update the runbooks and their scripts for the flows that show the Operation log

### Out of scope

- Keeping the log across a page reload
- Filtering, searching or clearing the log
- Collapsing or expanding single entries
- API changes

### Tasks

- [ ] Record every API call of the bookings page in the Operation log
- [ ] Show JSON request and response bodies on multiple lines in the Operation log
- [ ] Limit the Operation log panel height, with scrolling inside the panel
- [ ] Keep the last 30 entries in the Operation log
- [ ] Update the runbooks of the flows that show the Operation log

## Acceptance criteria

- [ ] Opening the page adds an entry for `GET /resources` and an entry for `GET /bookings`, each with its response
- [ ] Clicking Retry after a failed load adds new entries for the calls it sends
- [ ] Each availability check the live preview sends adds a `GET /availability` entry with its response
- [ ] After Book or Cancel, the log shows the POST entry and, above it, the `GET /bookings` re-fetch entry
- [ ] A JSON request or response body shows on multiple indented lines
- [ ] A reply that is not JSON, or a request that fails, shows its text as it came
- [ ] A successful GET shows in green and a failed call shows in red, and Book and Cancel replies keep their current colors
- [ ] The panel grows with its entries up to 640px tall, and past that the entries scroll inside the panel while the page length stays the same
- [ ] After more than 30 calls the log shows only the latest 30, and entry numbers keep counting up
- [ ] The runbooks of the flows that show the Operation log describe the new behavior and pass
