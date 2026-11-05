---
id: SCH-5
title: Implement the pure booking rules parseInterval and overlaps with unit tests
type: feature
status: in_progress
estimate: 2
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-3]
branch: sch-5-implement-the-pure-booking-rules
created: 2026-11-04T20:00:44.336Z
updated: 2026-11-05T00:03:34Z
---

## Acceptance criteria

- [ ] `parseInterval(start, end)` returns `{ start, end }` as numbers only when both values are integers (or digit-only strings) from 0 to 2147483647 and `start < end`
- [ ] `parseInterval` returns `null` for a missing value, a non-integer, a negative value, a value above 2147483647, a malformed string, `start == end` and `start > end`
- [ ] `overlaps` treats intervals as `[start, end)`: `[10,20)` and `[20,30)` do not overlap, `[10,20)` and `[19,21)` do
- [ ] `overlaps` is symmetric and detects containment, for example `[10,30)` and `[15,20)`
- [ ] Both are pure functions in `booking-rules.ts` with unit tests, and test, lint, typecheck and build pass

## Description

### Context

Third step of SCH-2, blocked only by the SCH-3 scaffold. The architecture (`docs/diagrams/architecture.md`, backend modules) keeps the `[start, end)` rule in one place, so SCH-6 (create) and SCH-7 (availability) call the same two pure functions instead of each writing its own comparison.

SCH-4 kept the time columns as Postgres `integer` (int32) and decided that the interval check rejects values outside that range, so they end as `invalid_data` and never as a database error.

### Scope (in)

- `api/src/bookings/booking-rules.ts` with pure functions and no Nest or TypeORM imports:
  - `type Interval = { start: number; end: number }`, shared with the service and the `Booking` entity
  - `parseInterval(start: unknown, end: unknown): Interval | null`: each value is a number or a digit-only string (`/^\d+$/`, converted with `Number()`), an integer from 0 to 2147483647, and `start < end`; it returns the numbers, or `null` for `invalid_data`
  - `overlaps(a, b)`: `a.start < b.end && b.start < a.end`, with valid intervals as a precondition
- Vitest unit tests in `booking-rules.spec.ts` for the boundaries: touching intervals, a one-unit overlap, containment, identical intervals, `start == end`, reversed, non-integer, negative, out of range and malformed strings

### Out of scope

- `BookingsModule`, `BookingsService` and every endpoint (SCH-6 to SCH-8)
- Checking that the resource exists or that the id is free (SCH-6)

### Decisions (design session)

- `parseInterval` takes `unknown` and owns the type check and the string conversion, so SCH-6 and SCH-7 pass the raw body and query values
- Only digit-only strings are converted: `""`, `" 10 "`, `"1e3"`, `"0x10"`, `"10.0"`, `"+10"` and `"-5"` are `invalid_data`
- Negative times are invalid
- `Interval` is a named type exported from `booking-rules.ts`
