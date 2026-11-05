# SCH-8: Cancel and list bookings

Sharpened spec from the grill session on SCH-8. Inputs: `.issues/docs/PRD.md`, `docs/diagrams/architecture.md` (sections 2 and 4.3), `GLOSSARY.md` (new term **Cancel**), `docs/adr/0001-nested-resource-in-booking-responses.md`, the SCH-6 and SCH-7 designs, the SCH-8 acceptance criteria and its two comments (notes from SCH-6 and SCH-7).

## Why

The PRD asks to cancel a booking (frees its interval, keeps its id taken, `already_canceled` on a second cancel, an error for an unknown id) and to list bookings showing which are active or canceled. SCH-10's web app will show that list with resource names, so every booking response now carries the resource's name (ADR 0001).

## Goals

- `POST /bookings/:id/cancel` and `GET /bookings`, as below.
- One Booking response shape on list, create and cancel: `{ id, resource: { id, name }, start, end, status }`.
- Prove against Postgres, through runbooks, that a canceled booking stops conflicting while its id stays taken.

## Non-goals

- Deleting a booking, or reactivating a canceled one. No way back from Canceled to Active.
- Filters, paging or sorting options on `GET /bookings`: the UI filters on the client, the data set is small.
- Changing requests: `POST /bookings` still takes `"resource": "R1"`, `/availability` still takes `?resource=R1`, and `conflicts` stays a list of ids.
- The web app (SCH-10), the PRD replay e2e (SCH-9), concurrency (PRD).

## Booking response shape (changes SCH-6's contract)

`{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }`

Used by the 201 of `POST /bookings`, every item of `GET /bookings`, and `booking` in both cancel results. The `Booking` entity keeps `resource: string` (it is the storage shape, `resource_id`); the response is a separate type built by the service. The `Booking` entity comment "a Booking is also the response body" is no longer true and is updated.

## `POST /bookings/:id/cancel`

The request body is ignored. A malformed JSON body still gets Nest's parser 400 (`NestError`), as on create. Checks, first match wins:

| # | Result | Status | Body | When |
|---|---|---|---|---|
| 1 | `not_found` | 404 | `{ error: "not_found", message: "No booking has this id." }` | `id` does not match `^[A-Za-z0-9_-]{1,64}$` (no database call; covers NUL, which Postgres `text` cannot hold) |
| 2 | `not_found` | 404 | same | no booking has this id (exact, case-sensitive: `a` is not `A`) |
| 3 | `already_canceled` | 200 | `{ result: "already_canceled", booking }` | the booking is Canceled; nothing is written |
| 4 | `canceled` | 200 | `{ result: "canceled", booking }` | the booking was Active; its `status` is set to `canceled`, the row stays, `booking.status` is `canceled` |

Nest answers POST with 201 by default, so the handler sets 200 explicitly.

Builder's calls (not discussed):
- `POST /bookings//cancel` (empty id) and an id containing a raw `/` never reach the handler; Nest's router answers 404 with its default `NestError` body. The OpenAPI 404 description says so; no code handles it.
- On `canceled`, the response uses the row already read with `status` set to `canceled`, not a second read.
- The booking and its resource come from one `JOIN` (see Backend shape). The foreign key means every booking has its resource, so an inner join never drops a row.

## `GET /bookings`

No query params; unknown ones are ignored. 200 with a bare array of every booking, Active and Canceled, in the response shape above, in ascending id order by character code (`ORDER BY id COLLATE "C"`, as `findActiveByResource` already does). An empty table returns `[]`.

## Backend shape

- `BookingsRepository` reads bookings with their resource in one SQL `JOIN` on `resource` (decided after the builder check), returning the response shape:
  - `findAllWithResource()`: every booking, ascending id by `COLLATE "C"`.
  - `findByIdWithResource(id)`: one booking or `null`.
  - `setStatus(id, status)`: an `UPDATE`, never a delete.
  - `findById` and `findActiveByResource` stay as they are for create and availability.
- `ResourcesService` gains `findById(id): Promise<Resource | null>`. Create calls it instead of `exists` (one query that also yields the name, since the booking is not stored yet there is nothing to join); availability keeps `exists`.
- `BookingsService`:
  - `create` returns the response shape, built from the parsed booking and the resource found in the `unknown_resource` check. Check order and rejections are unchanged.
  - `cancel(id: string)` returns `{ ok: true, result: 'canceled' | 'already_canceled', booking } | { ok: false, error: 'not_found' }`. It reuses the existing `ID` regex for check 1, then `findByIdWithResource`, then `setStatus` only when Active.
  - `list()` returns `findAllWithResource()` as is.
- `BookingsController` adds `@Post('bookings/:id/cancel')` with `@HttpCode(200)` and `@Get('bookings')`, and only maps results to status and body. The status map gains `not_found: 404`.
- No migration: the `booking` table, its `status` column and the `resource_id` foreign key exist (SCH-4).

## Tests and docs

- `BookingsService` unit tests (repository and `ResourcesService` mocked): cancel of an Active booking calls `setStatus` and returns `canceled` with the nested resource; cancel of a Canceled booking returns `already_canceled` and never calls `setStatus`; unknown id returns `not_found`; an id failing the pattern (65 chars, NUL, space) returns `not_found` without calling `findById`; `list` keeps the repository order and nests each resource; `create` returns the nested resource. Existing create and availability tests keep passing, adjusted for `findById`.
- `BookingsController` unit tests: each cancel result maps to its status and body; `list` returns the service's array; create returns the nested shape.
- `api/openapi.yaml` in the same commit as the endpoints: `GET /bookings`, `POST /bookings/{id}/cancel` (200 with a `CancelResult` schema, 404), `not_found` added to the `BookingError` enum, `Booking.resource` becomes `$ref: Resource`. Validate with `npx @redocly/cli lint api/openapi.yaml`.
- Runbooks (api surface, scripts in `api/test/runbooks/`, one test per step, against `bookings_test`):
  - New `bookings.cancel-booking` via `/runbooks:create`: cancel an Active booking (200 `canceled`, read back through `GET /bookings`); cancel it again (200 `already_canceled`, nothing changed); unknown id (404 `not_found`); case-sensitive id (`a` when only `A` exists, 404); after canceling A R1 `[10,20)`, `POST /bookings` C R1 `[10,20)` returns 201; after canceling A, `POST /bookings` A on any free interval returns 409 `id_taken` (the PRD example's last line, and the SCH-6 note).
  - New `bookings.list-bookings` via `/runbooks:create`: empty list is `[]`; Active and Canceled bookings both listed with their status and nested resource; ids `B`, `a`, `10`, `9` come back as `10`, `9`, `B`, `a`.
  - `bookings.check-availability` via `/runbooks:update`: add "a check writes nothing" (`GET /bookings` before and after a check are equal) and "a canceled booking no longer conflicts" (A R1 `[10,20)` canceled, `GET /availability?resource=R1&start=10&end=20` returns `available: true, conflicts: []`). Remove both from "Not covered".
  - `bookings.create-booking` via `/runbooks:update`: every expected 201 body nests `resource` as `{ "id": "R1", "name": "Agora Room" }`; the "Not covered" entry about canceled bookings now points to `bookings.cancel-booking`.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass, then `/runbooks:list --affected` and `/runbooks:run --affected`.

## Decisions (agreed in the grill session)

- Both cancel outcomes share one body, `{ result, booking }`, and the client branches on `result`, rather than an `error` key on a 200.
- An id that cannot exist is `not_found`, not `invalid_data`: the PRD lists only `not_found` for cancel.
- Nested `resource: { id, name }` on every booking response, plain id on every request (ADR 0001).
- SCH-8 carries the create contract change rather than a separate issue.

## Left to the builder

- Names of the response type, the repository methods and the OpenAPI schema for the cancel result.
- How the join is written (raw SQL through the TypeORM repository, or a query builder), as long as `Booking` stays the plain storage entity, `start`/`end` come back as numbers and the order is `COLLATE "C"`.
- The `JOIN` itself is tested by the runbook scripts against Postgres (nested resource on list and cancel); unit tests mock the repository.
