---
id: SCH-5
title: Implement the pure booking rules validInterval and overlaps with unit tests
type: feature
status: backlog
estimate: 2
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-3]
created: 2026-11-04T20:00:44.336Z
updated: 2026-11-04T23:25:54Z
---

## Acceptance criteria

- [ ] `validInterval(start, end)` is true only when both values are integers inside the Postgres `integer` range and `start < end`
- [ ] `validInterval` rejects a missing value, a non-integer, a value outside the `integer` range, `start == end` and `start > end`
- [ ] `overlaps` treats intervals as `[start, end)`: `[10,20)` and `[20,30)` do not overlap, `[10,20)` and `[19,21)` do
- [ ] `overlaps` is symmetric and detects containment, for example `[10,30)` and `[15,20)`
- [ ] Both are pure functions in `booking-rules.ts` with unit tests, and test, lint, typecheck and build pass

## Description

### Context

Third step of SCH-2, blocked only by the SCH-3 scaffold. The architecture (`docs/diagrams/architecture.md`, backend modules) keeps the `[start, end)` rule in one place, so SCH-6 (create) and SCH-7 (availability) call the same two pure functions instead of each writing its own comparison.

SCH-4 kept the time columns as Postgres `integer` (int32) and decided that `validInterval` rejects values outside that range, so they end as `invalid_data` and never as a database error.

### Scope (in)

- `api/src/bookings/booking-rules.ts` with two pure functions and no Nest or TypeORM imports:
  - `validInterval(start, end)`: both values are integers from -2147483648 to 2147483647, and `start < end`
  - `overlaps(a, b)`: `a.start < b.end && b.start < a.end`
- Vitest unit tests in `booking-rules.spec.ts` for the boundaries: touching intervals, a one-unit overlap, containment, identical intervals, `start == end`, reversed, non-integer and out of range

### Out of scope

- `BookingsModule`, `BookingsService` and every endpoint (SCH-6 to SCH-8)
- Checking that the resource exists or that the id is free (SCH-6)
- Turning HTTP input (query strings, JSON bodies) into numbers, unless the design step moves that here

### Open questions for the design step

- Does `validInterval` take `unknown` values and own the type check, or do SCH-6 and SCH-7 parse the request first and pass numbers?
- Are negative times valid? The PRD only says "numbers"
- Is `Interval` (from `GLOSSARY.md`) a named type shared with the service?
