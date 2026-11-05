# SCH-7: Check availability with `GET /availability`

Sharpened spec from the grill session on SCH-7. Inputs: `.issues/docs/PRD.md`, `docs/diagrams/architecture.md` (section 4.2), `GLOSSARY.md`, the SCH-6 design (`2026-11-04-sch-6-create-booking-design.md`) and the SCH-7 acceptance criteria.

## Why

The PRD asks for a way to check an interval without booking it: report whether it is available and which active bookings conflict, in ascending id order, without changing data. The check must never disagree with create, so it runs the same rule through the same code.

## Request

`GET /availability?resource=&start=&end=`. Query values arrive as strings, or as arrays when a param repeats. Unknown params (for example `id`) are ignored.

## Checks, in order

The first failing check wins. Nothing is ever written.

| # | Code | Status | When |
|---|---|---|---|
| 1 | `invalid_data` | 422 | `resource` is missing, not a string (an array from a repeated param), empty, or contains NUL; or `parseInterval(start, end)` returns `null` (missing, an array, not digit-only like `abc`, `1.5`, `-1`, above 2147483647, or `start >= end`) |
| 2 | `unknown_resource` | 404 | `ResourcesService.exists(resource)` is false. Exact match: `r1` is unknown |
| - | answered | 200 | Always 200 once valid, available or not |

## Responses

- 200 body is exactly `{ available: boolean, conflicts: string[] }`, with `available === (conflicts.length === 0)`. No echo of the query.
- `conflicts` holds ids, not bookings, the same shape as the `conflict` rejection of create. Ascending id order by character code (`10`, `9`, `B`, `a`), from the repository's `ORDER BY id COLLATE "C"`. The service does not re-sort.
- Errors use the shared body `{ error, message }` and the existing code-to-status map. Messages:
  - `invalid_data`: "Send resource, and integer start and end from 0 to 2147483647 with start before end." (create's message asks for an `id`, which availability does not take).
  - `unknown_resource`: the existing "This resource does not exist."

## Backend shape

- `BookingsController` becomes `@Controller()` with `@Post('bookings')` (unchanged behavior) and `@Get('availability')`. One controller, as in the architecture diagram. The new handler passes `@Query('resource')`, `@Query('start')` and `@Query('end')` raw to the service and only maps the result.
- `BookingsService.availability(resource: unknown, start: unknown, end: unknown)` validates and returns a result union: `{ ok: true, available, conflicts } | { ok: false, error: 'invalid_data' | 'unknown_resource' }`.
- A private `BookingsService.findConflicts(resource, interval): Promise<string[]>` (`findActiveByResource` → `filter(overlaps)` → ids). `create` is refactored to call it, so create and availability share one lookup and one `overlaps`.
- A small `isResourceId(value)` check (string, non-empty, no NUL) pulled out of `parseBooking`, used by both flows.
- No repository or migration change.

## Tests and docs

- `BookingsService` unit tests (repository and `ResourcesService` mocked): available and not available; the `[10,20)` / `[20,30)` boundary; other-resource and canceled bookings do not conflict (canceled ones are absent from `findActiveByResource`); every `invalid_data` input, including a repeated `resource`; `unknown_resource`; `conflicts` keeps the repository order; `insert` is never called. Existing `create` tests still pass after the refactor.
  The `insert`-never-called test is what meets the acceptance criterion "the check writes nothing, and a test asserts the bookings are unchanged after it" inside SCH-7, as agreed in the grill session. The issue wording stays as it is; the HTTP read-back through `GET /bookings` is added later by SCH-8. Say so in the PR and in the review notes.
- `BookingsController` unit tests: each availability result maps to its status and body.
- Runbook `bookings.check-availability` (api surface) via `/runbooks:create`, script `api/test/runbooks/bookings-check-availability.spec.ts`, one test per step against `bookings_test`:
  1. R1 `[19,21)` after A `[10,20)` and B `[20,30)` returns `available: false, conflicts: [A, B]` (PRD example).
  2. R1 `[30,40)` is available (boundary).
  3. A booking on another resource does not conflict.
  4. Active bookings `B`, `a`, `10`, `9` come back as `["10", "9", "B", "a"]` (collation against real Postgres).
  5. `invalid_data`.
  6. `unknown_resource`.
- `api/openapi.yaml`: the `/availability` path (200, 404, 422) and an `Availability` schema. Validate with `npx @redocly/cli lint api/openapi.yaml`.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass, then `/runbooks:run --affected`.
- One comment on SCH-8 (previewed before writing): SCH-8 adds two steps to `bookings.check-availability`, a check followed by `GET /bookings` shows the bookings unchanged, and a canceled booking no longer conflicts.

## Out of scope

- Create, cancel and list (SCH-6, SCH-8); the HTTP read-back proving "nothing written" (SCH-8, see the note above); the PRD replay e2e (SCH-9); the UI panel (SCH-10).
- Full bookings in `conflicts`, and echoing the query in the response.

## Decisions

- Availability returns 200 with `available: false` rather than a 409: the check is a question, not a rejected write.
- `conflicts` holds ids in both create and availability, so the concept has one shape. Adding fields later is backward-compatible.
