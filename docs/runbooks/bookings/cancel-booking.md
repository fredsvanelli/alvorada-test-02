---
id: bookings.cancel-booking
title: Cancel a booking, freeing its interval while its id stays taken
capability: bookings
surface: api
feature: cancel-booking
tags: []
roles: []
covers:
  entries: ["POST /bookings/{id}/cancel"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-05-sch-8-cancel-and-list-design.md"]
scripts: ["api/test/runbooks/bookings-cancel-booking.spec.ts"]
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "b9ba3c1"
  result: passed
  report: _runs/2026-11-05-2306-bookings.cancel-booking.md
  runs:
    r1: { date: 2026-11-05, commit: "b9ba3c1", report: _runs/2026-11-05-2306-bookings.cancel-booking.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
---

# Cancel a booking, freeing its interval while its id stays taken

---

## Goal

Prove that `POST /bookings/{id}/cancel` answers 200 with `{ result, booking }`, where `result` is `canceled` when the booking was active (its `status` becomes `canceled` and the row stays) or `already_canceled` when it was canceled already (nothing changes), and 404 `not_found` for an id no booking has, matched exactly. A canceled booking no longer conflicts on create, while its id still answers `id_taken`.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`) with `Test.createTestingModule({ imports: [AppModule] })`, calls `app.listen(0)` once, closes the app in `afterAll`, and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Database schema and seed: the script runs against the disposable test database `bookings_test` (`POSTGRES_DB` in `api/vitest.config.ts`), which `api/test/global-setup.ts` drops, recreates and migrates before every Vitest run. The `booking` table and the resources R1 to R5 (R1 is named "Agora Room") come from the migration `api/src/database/migrations/1793750400000-InitSchema.ts`.
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: every step starts from an empty `booking` table (`beforeEach` empties it through the app's TypeORM `DataSource`). The bookings a step lists under "Given" are created in that step's test through `POST /bookings`, in the order listed and with the ids the step names, before the request under test; each of those creates must return 201. A booking written as `A R1 [10,20)` means the JSON body `{ "id": "A", "resource": "R1", "start": 10, "end": 20 }`. "A canceled" means `POST /bookings/A/cancel` was sent after the create and returned 200. Resources come only from the seed.
- Requests: the cancel request is sent with no body.

---

## Steps

### S01. Canceling an active booking returns it canceled and keeps the row

Parents: none
Requirement: none
Endpoint: `POST /bookings/{id}/cancel`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings/A/cancel
```

Expected: 200.

```json
{
  "result": "canceled",
  "booking": { "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "canceled" }
}
```

The body has exactly these keys. Read-back: `GET /bookings` then returns 200 with exactly

```json
[{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "canceled" }]
```

so the row is kept, with its status changed, not deleted.

---

### S02. Canceling a canceled booking returns already_canceled and changes nothing

Parents: S01
Requirement: none
Endpoint: `POST /bookings/{id}/cancel`
As: anonymous
Given: A R1 `[10,20)`, A canceled.
Request:

```http
POST /bookings/A/cancel
```

Expected: 200.

```json
{
  "result": "already_canceled",
  "booking": { "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "canceled" }
}
```

The body has exactly these keys. Read-back: the body of `GET /bookings` after this request equals its body read right before it.

---

### S03. An id no booking has returns not_found

Parents: none
Requirement: none
Endpoint: `POST /bookings/{id}/cancel`
As: anonymous
Given: no booking.
Request:

```http
POST /bookings/Z/cancel
```

Expected: 404.

```json
{ "error": "not_found", "message": "<string>" }
```

The body has exactly these two keys. Today's message is "No booking has this id."; its text is not checked.

---

### S04. Ids are case-sensitive: `a` does not cancel `A`

Parents: none
Requirement: none
Endpoint: `POST /bookings/{id}/cancel`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings/a/cancel
```

Expected: 404.

```json
{ "error": "not_found", "message": "<string>" }
```

The body has exactly these two keys. Read-back: `GET /bookings` then returns 200 with exactly

```json
[{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }]
```

so A is still active.

---

### S05. A canceled booking no longer conflicts

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`, A canceled.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "C", "resource": "R1", "start": 10, "end": 20 }
```

Expected: 201.

```json
{ "id": "C", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }
```

The body has exactly these keys. The same request with A still active would return 409 `conflict` (`bookings.create-booking` S08).

---

### S06. A canceled booking's id stays taken

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`, A canceled.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": 30, "end": 40 }
```

Expected: 409.

```json
{ "error": "id_taken", "message": "<string>" }
```

The body has exactly these two keys. `[30,40)` is free on R1, so only the id is rejected. This is the last line of the PRD example.

---

## Not covered

- An id that cannot exist (65 characters, NUL, a space) returns `not_found` without a database query: left out of the agreed steps. The service checks the id against `^[A-Za-z0-9_-]{1,64}$` before any lookup (`cancel` in `api/src/bookings/bookings.service.ts`), and the unit test "returns not_found for %j without a query" in `api/src/bookings/bookings.service.spec.ts` covers each of those ids and that the repository is not called. "Without a query" is not observable over HTTP.
- An empty id (`POST /bookings//cancel`) or an id containing `/`: Nest's router answers 404 with its default body (`NestError`) before the handler runs; no project code handles it (`api/openapi.yaml`, the 404 of `POST /bookings/{id}/cancel`).
- The request body is ignored, and a malformed JSON body gets the JSON parser's 400 (`NestError`): left out of the agreed steps. The handler reads only the `id` path param (`api/src/bookings/bookings.controller.ts`, `@Post('bookings/:id/cancel')`); `bookings.create-booking` S04 proves the parser's 400 on the same app.
- There is no way back from canceled to active, and no delete: no endpoint exists for either (spec, Non-goals).
- A validation error (422): the endpoint has none. An id that cannot exist is `not_found`, not `invalid_data`, because the PRD lists only `not_found` for cancel (spec, Decisions).
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- Concurrent cancels of the same booking: concurrency is out of scope (PRD).
- The text of `message` in error bodies: it is for people, and clients branch on `error` (`api/openapi.yaml`, `BookingError`). Steps check only that it is a string.
- A database failure during the cancel: the code has no handler of its own for it (Nest's default 500). Database reachability is proven by `health.check-database`.

---

## Cleanup

- Isolated by `beforeEach`, which empties the `booking` table through the app's TypeORM `DataSource`, in the disposable `bookings_test` database. The app is closed in `afterAll`.
