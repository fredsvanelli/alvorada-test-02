---
id: SCH-13
title: Name the Availability response type and assert no insert in the available case
type: feature
status: in_progress
estimate: 1
assignee: fred-vanelli
related: [SCH-7]
branch: sch-13-name-the-availability-response-type-and
created: 2026-11-05T03:01:42.874Z
updated: 2026-11-05T23:42:19Z
---

## Description

### Context

Follow-up from SCH-7 (PR #8), two small cleanups from the review:

- `BookingsController.availability` writes its return type `{ available: boolean; conflicts: string[] }` inline instead of naming it next to `AvailabilityResult` in `bookings.service.ts`.
- The "never writes" unit test covers only the not-available case; the available case does not assert `insert` is not called.

### Scope (in)

- Export an `Availability` type from `api/src/bookings/bookings.service.ts` and use it in the controller and in `AvailabilityResult`.
- Assert `insert` is not called in the "is available when nothing overlaps" test.

### Out of scope

- Any behavior change.

## Acceptance criteria

- [ ] The controller's availability handler returns a named `Availability` type exported from `bookings.service.ts`
- [ ] The available-case unit test asserts `insert` is not called
- [ ] test, lint, typecheck and build pass
