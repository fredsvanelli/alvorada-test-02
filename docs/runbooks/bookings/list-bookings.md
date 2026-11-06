---
id: bookings.list-bookings
title: List every booking with its status and resource, in ascending id order
capability: bookings
surface: api
feature: list-bookings
tags: []
roles: []
covers:
  entries: ["GET /bookings"]
  requirements: []
sources: ["docs/superpowers/specs/2026-11-05-sch-8-cancel-and-list-design.md", "text \"POST /bookings/:id/cancel now exists; add the step listing active and canceled bookings together\"", "text \"fix the Not covered line about read-back\""]
scripts: ["api/test/runbooks/bookings-list-bookings.spec.ts"]
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "b9ba3c1"
  result: passed
  report: _runs/2026-11-05-2306-bookings.list-bookings.md
  runs:
    r1: { date: 2026-11-05, commit: "b9ba3c1", report: _runs/2026-11-05-2306-bookings.list-bookings.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
    S04: passed r1
---

# List every booking with its status and resource, in ascending id order

---

## Goal

Prove that `GET /bookings` answers 200 with a bare array of every booking, active and canceled, in the shape `{ id, resource: { id, name }, start, end, status }`, the resource nested with its seeded name and `start`/`end` as JSON numbers, in ascending id order by character code, and `[]` when there are no bookings.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`) with `Test.createTestingModule({ imports: [AppModule] })`, calls `app.listen(0)` once, closes the app in `afterAll`, and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Database schema and seed: the script runs against the disposable test database `bookings_test` (`POSTGRES_DB` in `api/vitest.config.ts`), which `api/test/global-setup.ts` drops, recreates and migrates before every Vitest run. The `booking` table and the resources R1 to R5 come from the migration `api/src/database/migrations/1793750400000-InitSchema.ts`, which seeds R1 as "Agora Room" and R2 as "Pixel Room".
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: every step starts from an empty `booking` table (`beforeEach` empties it through the app's TypeORM `DataSource`). The bookings a step lists under "Given" are created in that step's test through `POST /bookings`, in the order listed and with the ids the step names, before the request under test; each of those creates must return 201. A booking written as `A R1 [10,20)` means the JSON body `{ "id": "A", "resource": "R1", "start": 10, "end": 20 }`. A booking the step lists as canceled is canceled after all the creates, through `POST /bookings/<id>/cancel` with no body; that call must return 200. Resources come only from the seed.
- Requests: the request line is sent exactly as written, with no query and no body.

---

## Steps

### S01. An empty booking table lists no bookings

Parents: none
Requirement: none
Endpoint: `GET /bookings`
As: anonymous
Given: no bookings.
Request:

```http
GET /bookings
```

Expected: 200.

```json
[]
```

The body is an empty JSON array, not an object and not `null`.

---

### S02. Each booking is listed with its nested resource, status and numeric interval

Parents: none
Requirement: none
Endpoint: `GET /bookings`
As: anonymous
Given: A R1 `[10,20)` and B R2 `[10,20)`.
Request:

```http
GET /bookings
```

Expected: 200.

```json
[
  { "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "active" },
  { "id": "B", "resource": { "id": "R2", "name": "Pixel Room" }, "start": 10, "end": 20, "status": "active" }
]
```

The whole body equals this array (strict equality): exactly two items, in this order, each with exactly these five keys and the nested `resource` with exactly `id` and `name`. `start` and `end` are JSON numbers, not strings. The names come from the seed, read through the `JOIN` on `resource` in `api/src/bookings/bookings.repository.ts`.

---

### S03. Bookings are ordered by id, by character code

Parents: S02
Requirement: none
Endpoint: `GET /bookings`
As: anonymous
Given, created in this order: B R1 `[0,1)`, a R1 `[1,2)`, 10 R1 `[2,3)` and 9 R1 `[3,4)` (ids `"B"`, `"a"`, `"10"` and `"9"`, all strings). The intervals are disjoint so each create returns 201.
Request:

```http
GET /bookings
```

Expected: 200.

```json
[
  { "id": "10", "resource": { "id": "R1", "name": "Agora Room" }, "start": 2, "end": 3, "status": "active" },
  { "id": "9", "resource": { "id": "R1", "name": "Agora Room" }, "start": 3, "end": 4, "status": "active" },
  { "id": "B", "resource": { "id": "R1", "name": "Agora Room" }, "start": 0, "end": 1, "status": "active" },
  { "id": "a", "resource": { "id": "R1", "name": "Agora Room" }, "start": 1, "end": 2, "status": "active" }
]
```

The ids come back as `["10", "9", "B", "a"]`, exactly these four in this order: digits before upper case before lower case, and `10` before `9` because ids compare as text, by character code (`ORDER BY b.id COLLATE "C"` in `api/src/bookings/bookings.repository.ts`), not by the database's `en_US` collation (which would put `a` before `B`) nor by creation order.

---

### S04. Active and canceled bookings are listed together, each with its status

Parents: S02
Requirement: none
Endpoint: `GET /bookings`
As: anonymous
Given: A R1 `[10,20)` and B R1 `[20,30)`, then A canceled through `POST /bookings/A/cancel` (200).
Request:

```http
GET /bookings
```

Expected: 200.

```json
[
  { "id": "A", "resource": { "id": "R1", "name": "Agora Room" }, "start": 10, "end": 20, "status": "canceled" },
  { "id": "B", "resource": { "id": "R1", "name": "Agora Room" }, "start": 20, "end": 30, "status": "active" }
]
```

The whole body equals this array (strict equality): exactly these two bookings, in id order A, B. The canceled booking stays in the list with `status: "canceled"` (cancel sets the status and keeps the row, `setStatus` in `api/src/bookings/bookings.repository.ts`), and the list does not filter by status (`findAllWithResource`).

---

## Not covered

- Unknown query params (for example `?status=active`) are ignored: left out of the agreed steps. The controller takes no query (`api/src/bookings/bookings.controller.ts`, `@Get('bookings')`).
- Invalid input (422): the endpoint takes no query and no body, so no input can be invalid.
- A read-back: the endpoint only reads, so no separate read-back is needed. `bookings.cancel-booking` (S01, S02, S04) and `bookings.check-availability` (S07) use it as their read-back.
- Filters, paging and sorting options: non-goals of the SCH-8 spec; the web app filters on the client.
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- A database failure during the list: the code has no handler of its own for it (Nest's default 500). Database reachability is proven by `health.check-database`.

---

## Cleanup

- Isolated by `beforeEach`, which empties the `booking` table through the app's TypeORM `DataSource`, in the disposable `bookings_test` database. The app is closed in `afterAll`.
