---
id: SCH-19
title: "Show user-triggered API calls in the Operation log, with multiline JSON and a taller scrolling panel"
type: feature
status: done
priority: medium
estimate: 3
assignee: fred-vanelli
branch: sch-19-show-every-api-call-in-the-operation-log
created: 2026-11-06T02:31:26.860Z
updated: 2026-11-06T06:12:32Z
---

## Description

### Context

The Operation log shows how the page talks to the API during a demo, but it records only the Book and Cancel POSTs. The live preview also sends `GET /availability` for what the user types, and the log leaves those out. JSON bodies print on one line, so long replies are hard to read. The panel has no height limit and keeps the last 14 entries. Once the preview checks are logged, the checks of a single booking would fill those 14 entries.

### Scope (in)

- Log the API calls that come from a direct user action: Book, Cancel, and each `GET /availability` the live preview sends after the user edits a field
- Leave out the calls the page sends on its own: `GET /resources` and `GET /bookings` (page load, Retry, the re-fetch after a write) and the availability re-check a write triggers
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

- [ ] Record the API calls of direct user actions in the Operation log
- [ ] Show JSON request and response bodies on multiple lines in the Operation log
- [ ] Limit the Operation log panel height, with scrolling inside the panel
- [ ] Keep the last 30 entries in the Operation log
- [ ] Update the runbooks of the flows that show the Operation log

## Acceptance criteria

- [ ] Opening the page and clicking Retry add no entry: `GET /resources` and `GET /bookings` are not logged
- [ ] Each availability check sent after the user edits Id, Resource, Start or End adds a `GET /availability` entry with its response
- [ ] After Book or Cancel, the log shows the POST entry; the `GET /bookings` re-fetch and the availability re-check it triggers add no entry
- [ ] A JSON request or response body shows on multiple indented lines
- [ ] A reply that is not JSON, or a request that fails, shows its text as it came
- [ ] A successful GET shows in green and a failed call shows in red, and Book and Cancel replies keep their current colors
- [ ] The panel grows with its entries up to 640px tall, and past that the entries scroll inside the panel while the page length stays the same
- [ ] After more than 30 calls the log shows only the latest 30, and entry numbers keep counting up
- [ ] The runbooks of the flows that show the Operation log describe the new behavior and pass
