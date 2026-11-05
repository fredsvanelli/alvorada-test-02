---
id: bookings.create-booking
title: Create a booking, or reject it without writing anything
capability: bookings
surface: api
feature: create-booking
tags: [critical]
roles: []
covers:
  entries: ["POST /bookings"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-04-sch-6-create-booking-design.md", "docs/superpowers/specs/2026-11-05-sch-8-cancel-and-list-design.md"]
scripts: ["api/test/runbooks/bookings-create-booking.spec.ts"]
status: active
last_run:
  date: 2026-11-04
  oldest: 2026-11-04
  commit: "946989c"
  result: passed
  report: _runs/2026-11-04-2350-bookings.create-booking.md
  outdated: true
  runs:
    r1: { date: 2026-11-04, commit: "946989c", report: _runs/2026-11-04-2350-bookings.create-booking.md }
  cells:
    S01: passed r1 outdated
    S02: passed r1 outdated
    S03: passed r1 outdated
    S04: passed r1 outdated
    S05: passed r1 outdated
    S06: passed r1 outdated
    S07: passed r1 outdated
    S08: passed r1 outdated
    S09: passed r1 outdated
    S10: passed r1 outdated
    S11: passed r1 outdated
    S12: passed r1 outdated
    S13: passed r1 outdated
    S14: passed r1 outdated
    S15: passed r1 outdated
    S16: passed r1 outdated
    S17: passed r1 outdated
    S18: passed r1 outdated
    S19: passed r1 outdated
    S20: passed r1 outdated
---

# Create a booking, or reject it without writing anything

---

## Goal

Prove that `POST /bookings` creates an `active` booking for a free `[start, end)` interval of a known resource, returning it with the resource nested as `{ id, name }` (ADR `docs/adr/0001-nested-resource-in-booking-responses.md`), and otherwise rejects it with `invalid_data` (422), `unknown_resource` (404), `id_taken` (409) or `conflict` (409, with the conflicting ids in ascending order by character code), checked in that order, without writing a row, so a rejected id stays free.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`) with `Test.createTestingModule({ imports: [AppModule] })`, calls `app.listen(0)` once, closes the app in `afterAll`, and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Database schema and seed: the script runs against the disposable test database `bookings_test` (`POSTGRES_DB` in `api/vitest.config.ts`), which `api/test/global-setup.ts` drops, recreates and migrates before every Vitest run. The `booking` table and the resources R1 to R5 come from the migration `api/src/database/migrations/1793750400000-InitSchema.ts`.
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: every step starts from an empty `booking` table (`beforeEach` empties it through the app's TypeORM `DataSource`). The bookings a step lists under "Given" are created in that step's test through `POST /bookings`, with the ids the step names, before the request under test; each of those creates must return 201. Resources come only from the seed, with these names: R1 `Agora Room`, R2 `Pixel Room`, R3 `4K Projector`.
- Requests: every request with a body sends `Content-Type: application/json`. A request written as `{ id, resource, [start,end) }` in a step title means the JSON body `{ "id": ..., "resource": ..., "start": start, "end": end }`, with numbers unless the step says otherwise. Requests send the resource as its id string (`"resource": "R1"`); a 201 body returns it as an object (`"resource": { "id": "R1", "name": "Agora Room" }`).
- Read-back: there is no `GET /bookings` yet (SCH-8), so a step proves what was or was not saved with a follow-up `POST /bookings` whose result depends on it (a conflict naming the saved booking, or a 201 that a saved row would have refused).

---

## Steps

### S01. A client creates a booking on a free interval

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": 10, "end": 20 }
```

Expected: 201.

```json
{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }
```

The body has exactly these five keys, and `resource` exactly `id` and `name`: the request sent `"resource": "R1"`, and the response nests R1 with its seeded name. Read-back: a following `POST /bookings` with `{ "id": "B", "resource": "R1", "start": 15, "end": 25 }` returns 409 with `{ "error": "conflict", "conflicts": ["A"] }`, so A was saved as an active booking of R1 at `[10,20)`.

---

### S02. Times sent as digit-only strings are stored and returned as numbers

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": "10", "end": "20" }
```

Expected: 201.

```json
{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }
```

`start` and `end` are JSON numbers, not strings. Read-back: a following `POST /bookings` with `{ "id": "B", "resource": "R1", "start": 19, "end": 21 }` returns 409 with `{ "error": "conflict", "conflicts": ["A"] }`.

---

### S03. Each invalid body returns invalid_data and writes nothing

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

One request per body in the table, each sent as below.

```http
POST /bookings
Content-Type: application/json

<body from the table>
```

| Case | Body |
|---|---|
| missing end | `{ "id": "A", "resource": "R1", "start": 10 }` |
| negative start | `{ "id": "A", "resource": "R1", "start": -1, "end": 20 }` |
| end above the integer range | `{ "id": "A", "resource": "R1", "start": 10, "end": 2147483648 }` |
| empty interval | `{ "id": "A", "resource": "R1", "start": 20, "end": 20 }` |
| id with a space | `{ "id": "a b", "resource": "R1", "start": 10, "end": 20 }` |
| 65-character id | `{ "id": "<65 times A>", "resource": "R1", "start": 10, "end": 20 }` |
| resource not a string | `{ "id": "A", "resource": 7, "start": 10, "end": 20 }` |
| array body | `[{ "id": "A", "resource": "R1", "start": 10, "end": 20 }]` |

Expected: 422, for each body.

```json
{ "error": "invalid_data", "message": "<string>" }
```

The body has no `conflicts` key. Read-back: afterwards, `POST /bookings` with `{ "id": "A", "resource": "R1", "start": 10, "end": 20 }` returns 201, so no rejected body wrote a row: id A is free and R1 `[10,20)` has no booking.

---

### S04. Malformed JSON and a top-level null get the JSON parser's 400

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

Two requests, one with each raw body.

```http
POST /bookings
Content-Type: application/json

{
```

```http
POST /bookings
Content-Type: application/json

null
```

Expected: 400, for each body.

```json
{ "statusCode": 400, "message": "<string>" }
```

This is Nest's default exception body (`NestError` in `api/openapi.yaml`), not a booking error: the JSON parser rejects the body before the controller runs. Known limit (spec, "Responses"). The text of `message` comes from the parser and is not checked.

---

### S05. An unknown resource returns unknown_resource, matched exactly

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

Two requests.

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R9", "start": 10, "end": 20 }
```

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "r1", "start": 10, "end": 20 }
```

Expected: 404, for each request.

```json
{ "error": "unknown_resource", "message": "<string>" }
```

The body has no `conflicts` key. `r1` is unknown because resource ids match exactly, case included.

---

### S06. A used id returns id_taken, whatever the resource and interval

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R2", "start": 50, "end": 60 }
```

Expected: 409.

```json
{ "error": "id_taken", "message": "<string>" }
```

The body has no `conflicts` key.

---

### S07. An interval that starts where another ends is accepted

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "B", "resource": "R1", "start": 20, "end": 30 }
```

Expected: 201.

```json
{ "id": "B", "resource": { "id": "R1", "name": "Agora Room" }, "start": 20, "end": 30, "status": "active" }
```

Intervals are half-open: `[10,20)` frees R1 at 20.

---

### S08. An overlap returns conflict with every conflicting id in ascending order

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "C", "resource": "R1", "start": 19, "end": 21 }
```

Expected: 409.

```json
{ "error": "conflict", "message": "<string>", "conflicts": ["A", "B"] }
```

`conflicts` has exactly these two ids, in this order.

---

### S09. A rejected id stays free, and another resource never conflicts

Parents: S08
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`, then the rejected attempt of S08, `POST /bookings` with C R1 `[19,21)`, which returns 409 `conflict`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "C", "resource": "R2", "start": 19, "end": 21 }
```

Expected: 201.

```json
{ "id": "C", "resource": { "id": "R2", "name": "Pixel Room" }, "start": 19, "end": 21, "status": "active" }
```

The rejected attempt wrote no row, so id C is free, and the bookings of R1 do not conflict with R2. `resource` names R2, not R1.

---

### S10. Ids are case-sensitive

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "a", "resource": "R1", "start": 30, "end": 40 }
```

Expected: 201.

```json
{ "id": "a", "resource": { "id": "R1", "name": "Agora Room" }, "start": 30, "end": 40, "status": "active" }
```

`a` and `A` are different ids.

---

### S11. Conflicting ids are ordered by character code

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given, created in this order: B R3 `[0,1)`, a R3 `[1,2)`, 10 R3 `[2,3)` and 9 R3 `[3,4)` (ids `"B"`, `"a"`, `"10"` and `"9"`, all strings).
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "X", "resource": "R3", "start": 0, "end": 4 }
```

Expected: 409.

```json
{ "error": "conflict", "message": "<string>", "conflicts": ["10", "9", "B", "a"] }
```

`conflicts` has exactly these four ids, in this order: digits before upper case before lower case, and `10` before `9` because ids compare as text, by character code (`ORDER BY id COLLATE "C"`), not by the database's locale collation.

---

### S12. The resource is checked before the id, and the id before the overlap

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`.
Request:

Two requests, in this order.

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R9", "start": 10, "end": 20 }
```

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": 10, "end": 20 }
```

Expected: the first returns 404, the second 409.

```json
{ "error": "unknown_resource", "message": "<string>" }
```

```json
{ "error": "id_taken", "message": "<string>" }
```

The first request has a used id and an unknown resource: `unknown_resource` wins. The second has a used id and overlaps A: `id_taken` wins, and its body has no `conflicts` key.

---

### S13. A request with no body returns invalid_data

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
```

No `Content-Type` header and no body.

Expected: 422.

```json
{ "error": "invalid_data", "message": "<string>" }
```

---

### S14. An empty resource is invalid_data, not unknown_resource

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "", "start": 10, "end": 20 }
```

Expected: 422.

```json
{ "error": "invalid_data", "message": "<string>" }
```

---

### S15. Times at both ends of the integer range are accepted

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": 0, "end": 2147483647 }
```

Expected: 201.

```json
{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 0, "end": 2147483647, "status": "active" }
```

`0` and `2147483647`, the upper bound of the Postgres `integer` columns, are valid times.

---

### S16. Times that are not non-negative integers or digit-only strings return invalid_data

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

One request per body in the table, each sent with `Content-Type: application/json`.

| Case | Body |
|---|---|
| fractional number | `{ "id": "A", "resource": "R1", "start": 10.5, "end": 20 }` |
| string in exponent notation | `{ "id": "A", "resource": "R1", "start": "1e1", "end": 20 }` |
| negative number as a string | `{ "id": "A", "resource": "R1", "start": "-5", "end": 20 }` |
| boolean | `{ "id": "A", "resource": "R1", "start": true, "end": 20 }` |

Expected: 422, for each body.

```json
{ "error": "invalid_data", "message": "<string>" }
```

---

### S17. Extra fields in the body are ignored, and a new booking is always active

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "A", "resource": "R1", "start": 10, "end": 20, "status": "canceled", "note": "x" }
```

Expected: 201.

```json
{ "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" }
```

The body has exactly these five keys, and `resource` exactly `id` and `name`: no `note`. Read-back: a following `POST /bookings` with `{ "id": "B", "resource": "R1", "start": 15, "end": 25 }` returns 409 with `{ "error": "conflict", "conflicts": ["A"] }`, so A was saved as active (a canceled booking never conflicts).

---

### S18. Invalid data is checked before the resource

Parents: none
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "a b", "resource": "R9", "start": 10, "end": 20 }
```

Expected: 422.

```json
{ "error": "invalid_data", "message": "<string>" }
```

The body has an invalid id and an unknown resource: `invalid_data` wins over `unknown_resource`.

---

### S19. conflicts lists only the bookings that overlap

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "C", "resource": "R1", "start": 25, "end": 35 }
```

Expected: 409.

```json
{ "error": "conflict", "message": "<string>", "conflicts": ["B"] }
```

`conflicts` has exactly one id: A ends at 20 and does not overlap `[25,35)`.

---

### S20. An interval that ends where another starts is accepted

Parents: S01
Requirement: none
Endpoint: `POST /bookings`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
POST /bookings
Content-Type: application/json

{ "id": "B", "resource": "R1", "start": 0, "end": 10 }
```

Expected: 201.

```json
{ "id": "B", "resource": { "id": "R1", "name": "Agora Room" }, "start": 0, "end": 10, "status": "active" }
```

Intervals are half-open: `[0,10)` ends before A starts at 10. S07 proves the other side of the boundary.

---

## Not covered

- A canceled booking never conflicts, and a canceled booking's id still returns `id_taken`: no endpoint cancels a booking yet (`POST /bookings/:id/cancel`, SCH-8), and the script creates data only through the API. The unit tests in `api/src/bookings/bookings.service.spec.ts` cover both with a mocked repository; add the steps when SCH-8 ships, through `/runbooks:update`.
- Concurrent creates with the same id or overlapping intervals: concurrency is out of scope (PRD). The check-then-insert is not atomic (`api/src/bookings/bookings.service.ts:60-69`); two simultaneous creates with the same id hit the primary key and return 500.
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- Read-back through `GET /bookings`: the endpoint does not exist yet (SCH-8). Each step proves what was saved through a follow-up `POST /bookings` instead.
- The text of `message` in error bodies: it is for people, and clients branch on `error` (`api/openapi.yaml`, `BookingError`). Steps check only that it is a string.
- A database failure during the create: the code has no handler of its own for it (Nest's default 500). Database reachability is proven by `health.check-database`.

---

## Cleanup

- Isolated by `beforeEach`, which empties the `booking` table through the app's TypeORM `DataSource`, in the disposable `bookings_test` database. The app is closed in `afterAll`.
