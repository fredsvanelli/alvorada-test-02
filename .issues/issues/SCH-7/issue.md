---
id: SCH-7
title: "Check availability with GET /availability, conflicts in ascending id order"
type: feature
status: in_progress
estimate: 3
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-4, SCH-5]
branch: sch-7-check-availability-with-get-availability
created: 2026-11-04T20:00:44.546Z
updated: 2026-11-05T02:14:27Z
---

## Acceptance criteria

- [ ] `GET /availability?resource=&start=&end=` returns 200 with `available` and `conflicts`; `available` is true when no active booking of the same resource overlaps
- [ ] `conflicts` lists the overlapping active bookings in ascending id order (R1 `[19,21)` after A and B returns A, B)
- [ ] Invalid data returns 422 `invalid_data` and an unknown resource returns 404 `unknown_resource`
- [ ] The check writes nothing, and a test asserts the bookings are unchanged after it
- [ ] Availability uses the same `overlaps` function as create
- [ ] Unit tests cover the service and the controller, and test, lint, typecheck and build pass

## Description

### Context

Fifth step of SCH-2, blocked by SCH-4 (the `booking` table and `ResourcesService.exists`) and SCH-5 (`parseInterval` and `overlaps`). It builds the availability flow from section 4.2 of `docs/diagrams/architecture.md`: a read-only question of whether an interval on a resource has any active conflicts, answered with the conflicts in ascending id order.

It uses the same rules and the same "active bookings of a resource ordered by id" query as create (SCH-6), so the two can never disagree. Whichever of SCH-6, SCH-7 and SCH-8 starts first creates `BookingsModule`, the `Booking` entity and `BookingsRepository`.

### Scope (in)

- `GET /availability?resource=&start=&end=` in `BookingsController`
- `BookingsService.availability(resource, start, end)`: the same `invalid_data` (422) and `unknown_resource` (404) checks as create, then the active bookings of the resource ordered by id, kept where `overlaps` is true
- A 200 response with `available` and `conflicts` in ascending id order
- Passing the raw query string values to `parseInterval`, which converts digit-only strings, so `start=abc`, `start=1.5`, `start=-1` or a missing `start` is `invalid_data`
- Unit tests for the service and the controller, including one that shows nothing is written

### Out of scope

- Creating, canceling or listing bookings (SCH-6 and SCH-8)
- An e2e test over HTTP against Postgres (SCH-9)
- The availability panel in the web app (SCH-10)

### Open questions for the design step

- What does `conflicts` contain: only the ids, or the full bookings (id, start, end) so the UI can show them?
- Should the conflict lookup be shared with create as one service method, so `conflict` and availability return the same list?
- Does the error body match the one SCH-6 chooses?
