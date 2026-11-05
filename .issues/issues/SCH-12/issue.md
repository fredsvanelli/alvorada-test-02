---
id: SCH-12
title: Prove over HTTP that an availability check holds nothing
type: feature
status: backlog
estimate: 1
assignee: fred-vanelli
related: [SCH-7]
created: 2026-11-05T03:01:42.703Z
updated: 2026-11-05T03:01:42Z
---

## Description

### Context

Follow-up from SCH-7 (PR #8). The final review noted that nothing proves over HTTP that an availability check holds nothing: an available answer must not reserve the interval. Today only a unit test asserts the service never calls `insert`. This step uses only endpoints that exist today, so it does not wait for SCH-8.

### Scope (in)

- One new step in `docs/runbooks/bookings/check-availability.md` via `/runbooks:update`: check R1 `[10,20)` → 200 available; then `POST /bookings` X R1 `[10,20)` → 201.
- The matching test in `api/test/runbooks/bookings-check-availability.spec.ts` via `/runbooks:to-test`.

### Out of scope

- The `GET /bookings` read-back and the canceled-booking step (SCH-8 adds them).

## Acceptance criteria

- [ ] The runbook has a step: an available check of R1 `[10,20)`, then creating a booking for R1 `[10,20)` returns 201
- [ ] Its script has one test for that step, and `/runbooks:run bookings.check-availability` passes
