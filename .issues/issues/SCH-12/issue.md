---
id: SCH-12
title: Prove over HTTP that an availability check holds nothing
type: feature
status: in_review
estimate: 1
assignee: fred-vanelli
related: [SCH-7]
branch: sch-12-prove-over-http-that-an-availability
created: 2026-11-05T03:01:42.703Z
updated: 2026-11-05T23:30:12Z
---

## Description

### Context

Follow-up from SCH-7 (PR #8). The final review noted that nothing proves over HTTP that an available answer claims nothing. `bookings.check-availability` S07 compares `GET /bookings` before and after a check, but only for a not-available answer, and a unit test asserts the service never calls `insert`. The runbook's "Not covered" section still lists this case.

### Scope (in)

- New step S14 in `docs/runbooks/bookings/check-availability.md` via `/runbooks:update`: with no bookings, `GET /availability?resource=R1&start=10&end=20&id=X` returns 200 available; then `POST /bookings` with X on R1 `[10,20)` returns 201. The check sends the id, so the step proves that neither the interval nor the id is claimed.
- The "Not covered" item keeps only concurrent checks and creates.
- The matching test in `api/test/runbooks/bookings-check-availability.spec.ts` via `/runbooks:to-test`.

### Out of scope

- A `GET /bookings` read-back in S14: a claim would already make the `POST` answer 409.
- The body of the 201, which `bookings.create-booking` checks.
- Concurrent checks and creates (PRD).

## Acceptance criteria

- [ ] The runbook has a step: an available check of R1 `[10,20)`, then creating a booking for R1 `[10,20)` returns 201
- [ ] Its script has one test for that step, and `/runbooks:run bookings.check-availability` passes
