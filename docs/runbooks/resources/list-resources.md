---
id: resources.list-resources
title: List the bookable resources
capability: resources
surface: api
feature: resources
tags: []
roles: []
covers:
  entries: ["GET /resources"]
  requirements: []
sources: ["map a93f56d", "api/src/resources/resources.controller.spec.ts", "api/src/resources/resources.service.spec.ts", "route GET /resources"]
scripts: ["api/test/runbooks/resources-list-resources.spec.ts"]
status: active
last_run:
  date: 2026-11-05
  oldest: 2026-11-05
  commit: "877471d"
  result: passed
  report: _runs/2026-11-05-0037-resources.list-resources.md
  runs:
    r1: { date: 2026-11-05, commit: "877471d", report: _runs/2026-11-05-0037-resources.list-resources.md }
  cells:
    S01: passed r1
---

# List the bookable resources

---

## Goal

Prove that `GET /resources` returns every fixed resource, R1 to R5 from the migration seed, each with its `id` and `name`, in ascending id order.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`), calls `app.listen(0)` once and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Database schema and seed: the script runs against the disposable test database `bookings_test` (`POSTGRES_DB` in `api/vitest.config.ts`), which `api/test/global-setup.ts` drops, recreates and migrates before every Vitest run. The `resource` table and its rows come from the migration `api/src/database/migrations/1793750400000-InitSchema.ts`.
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: the five seeded resources, unchanged. The script creates no data. No endpoint adds, edits or removes a resource.

---

## Steps

### S01. A client lists all five seeded resources in ascending id order

Parents: none
Requirement: none
Endpoint: `GET /resources`
As: anonymous
Request:

```http
GET /resources
```

Expected: 200.

```json
[
  { "id": "R1", "name": "Agora Room" },
  { "id": "R2", "name": "Pixel Room" },
  { "id": "R3", "name": "4K Projector" },
  { "id": "R4", "name": "Orbit Room" },
  { "id": "R5", "name": "Focus Room" }
]
```

The body is a plain JSON array of exactly these five items, in this order. Each item has only the keys `id` and `name`.

---

## Not covered

- Invalid input (422): the endpoint takes no query, path parameter or body, and has no validation.
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- Read-back: the endpoint is read-only and writes nothing.
- The `ORDER BY id ASC` itself: the seed inserts the rows in id order, so the response order cannot tell a sorted query from the table's natural order. The unit test `api/src/resources/resources.service.spec.ts` ("lists resources sorted by id in the query") asserts the query option `{ order: { id: 'ASC' } }` (`api/src/resources/resources.service.ts:14`).
- An empty list: the resources are a fixed seed and no endpoint removes one, and the code has no branch for an empty table.
- A database failure: the code has no handler of its own for it on this endpoint (Nest's default 500). Database reachability is proven by `health.check-database`.

---

## Cleanup

- Nothing to undo: no step writes data. The app is closed in `afterAll`.
