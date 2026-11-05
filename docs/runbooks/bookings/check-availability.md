---
id: bookings.check-availability
title: Check whether an interval is free on a resource, without booking it
capability: bookings
surface: api
feature: check-availability
tags: []
roles: []
covers:
  entries: ["GET /availability"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-04-sch-7-check-availability-design.md", "docs/superpowers/specs/2026-11-05-sch-8-cancel-and-list-design.md"]
scripts: ["api/test/runbooks/bookings-check-availability.spec.ts"]
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "877471d"
  result: passed
  report: _runs/2026-11-05-0037-bookings.check-availability.md
  runs:
    r1: { date: 2026-11-05, commit: "877471d", report: _runs/2026-11-05-0037-bookings.check-availability.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
    S05: passed r1
    S06: passed r1
    S07: passed r1
    S08: passed r1
---

# Check whether an interval is free on a resource, without booking it

---

## Goal

Prove that `GET /availability` answers 200 with `{ available, conflicts }` for a valid query, where `conflicts` lists the ids of the active bookings of the same resource that overlap the half-open interval `[start, end)`, in ascending id order by character code, and otherwise rejects the query with `invalid_data` (422) or `unknown_resource` (404), checked in that order.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`) with `Test.createTestingModule({ imports: [AppModule] })`, calls `app.listen(0)` once, closes the app in `afterAll`, and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Database schema and seed: the script runs against the disposable test database `bookings_test` (`POSTGRES_DB` in `api/vitest.config.ts`), which `api/test/global-setup.ts` drops, recreates and migrates before every Vitest run. The `booking` table and the resources R1 to R5 come from the migration `api/src/database/migrations/1793750400000-InitSchema.ts`.
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: every step starts from an empty `booking` table (`beforeEach` empties it through the app's TypeORM `DataSource`). The bookings a step lists under "Given" are created in that step's test through `POST /bookings`, in the order listed and with the ids the step names, before the request under test; each of those creates must return 201. A booking written as `A R1 [10,20)` means the JSON body `{ "id": "A", "resource": "R1", "start": 10, "end": 20 }`. "A canceled" means `POST /bookings/A/cancel` was sent, with no body, after the create and returned 200. Resources come only from the seed.
- Requests: query values are sent exactly as written in the request line, with no body.

---

## Steps

### S01. An interval that overlaps active bookings is not available, and lists them in ascending id order

Parents: none
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`.
Request:

```http
GET /availability?resource=R1&start=19&end=21
```

Expected: 200.

```json
{ "available": false, "conflicts": ["A", "B"] }
```

The body has exactly these two keys, and `conflicts` has exactly these two ids, in this order. This is the PRD example.

---

### S02. An interval that starts where the last booking ends is available

Parents: S01
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`.
Request:

```http
GET /availability?resource=R1&start=30&end=40
```

Expected: 200.

```json
{ "available": true, "conflicts": [] }
```

The body has exactly these two keys. Intervals are half-open: `[20,30)` frees R1 at 30.

---

### S03. Bookings of another resource never conflict

Parents: S01
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given: A R1 `[10,20)`.
Request:

```http
GET /availability?resource=R2&start=10&end=20
```

Expected: 200.

```json
{ "available": true, "conflicts": [] }
```

The same interval on R1 would conflict with A; only bookings of the same resource count.

---

### S04. Conflicting ids are ordered by character code

Parents: S01
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given, created in this order: B R1 `[0,1)`, a R1 `[1,2)`, 10 R1 `[2,3)` and 9 R1 `[3,4)` (ids `"B"`, `"a"`, `"10"` and `"9"`, all strings). The intervals are disjoint so each create returns 201; all four overlap the checked interval.
Request:

```http
GET /availability?resource=R1&start=0&end=5
```

Expected: 200.

```json
{ "available": false, "conflicts": ["10", "9", "B", "a"] }
```

`conflicts` has exactly these four ids, in this order: digits before upper case before lower case, and `10` before `9` because ids compare as text, by character code (`ORDER BY id COLLATE "C"` in `api/src/bookings/bookings.repository.ts`), not by the database's locale collation nor by creation order.

---

### S05. Each invalid query returns invalid_data

Parents: none
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Request:

One request per query in the table, each sent as below.

```http
GET /availability?<query from the table>
```

| Case | Query |
|---|---|
| start not a number | `resource=R1&start=abc&end=20` |
| start after end | `resource=R1&start=20&end=10` |
| missing resource | `start=10&end=20` |
| repeated resource | `resource=R1&resource=R2&start=10&end=20` |

Expected: 422, for each query.

```json
{ "error": "invalid_data", "message": "<string>" }
```

The body has no `conflicts` key and no `available` key. A repeated param arrives as an array, which is not a resource id. Today's message is "Send resource, and integer start and end from 0 to 2147483647 with start before end."; its text is not checked.

---

### S06. An unknown resource returns unknown_resource

Parents: none
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Request:

```http
GET /availability?resource=R9&start=10&end=20
```

Expected: 404.

```json
{ "error": "unknown_resource", "message": "<string>" }
```

The body has no `conflicts` key and no `available` key. R9 is not one of the seeded resources R1 to R5.

---

### S07. A check writes nothing

Parents: S01
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`. Then `GET /bookings` is sent and returns 200; its body is the "before" read-back.
Request:

```http
GET /availability?resource=R1&start=19&end=21
```

Expected: 200.

Read-back: `GET /bookings` sent after the check returns 200, and its body is strictly equal to the "before" read-back: the same bookings, in the same order, with the same fields and values. The check holds nothing and changes no status. Its own body is the one S01 checks.

---

### S08. A canceled booking no longer conflicts

Parents: S01
Requirement: none
Endpoint: `GET /availability`
As: anonymous
Given: A R1 `[10,20)`, A canceled.
Request:

```http
GET /availability?resource=R1&start=10&end=20
```

Expected: 200.

```json
{ "available": true, "conflicts": [] }
```

The body has exactly these two keys. A, while active, overlaps this exact interval; only active bookings count (the repository reads `status = 'active'`, `api/src/bookings/bookings.repository.ts`).

---

## Not covered

- The other `invalid_data` inputs (empty or NUL resource, missing, empty, repeated, decimal or negative start, end above 2147483647, start equal to end) and `invalid_data` winning over `unknown_resource`: left out of the agreed steps. The `it.each` "rejects %s as invalid_data" in `api/src/bookings/bookings.service.spec.ts` covers each input and that the resource lookup is not reached. Create shares the same `parseInterval`, and `bookings.create-booking` S03, S16 and S18 prove those rules over HTTP.
- An exact, case-sensitive resource match (`r1` is unknown): left out of the agreed steps. Availability uses the same `ResourcesService.exists` as create, which `bookings.create-booking` S05 proves with `r1`.
- Unknown query params (for example `id`) are ignored: left out of the agreed steps. The controller reads only `resource`, `start` and `end` (`api/src/bookings/bookings.controller.ts`, `@Get('availability')`).
- An available answer does not hold the interval, and concurrent checks and creates: the check is read-only, and concurrency is out of scope (PRD).
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- The text of `message` in error bodies: it is for people, and clients branch on `error` (`api/openapi.yaml`, `BookingError`). Steps check only that it is a string.
- A database failure during the check: the code has no handler of its own for it (Nest's default 500). Database reachability is proven by `health.check-database`.

---

## Cleanup

- Isolated by `beforeEach`, which empties the `booking` table through the app's TypeORM `DataSource`, in the disposable `bookings_test` database. The app is closed in `afterAll`.
