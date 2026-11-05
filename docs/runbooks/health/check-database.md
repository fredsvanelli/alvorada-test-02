---
id: health.check-database
title: The API reports whether it can reach the database
capability: health
surface: api
feature: health-check
tags: []
covers:
  entries: ["GET /health"]
  requirements: []
sources: ["route GET /health"]
scripts: ["api/test/runbooks/health-check-database.spec.ts"]
status: active
last_run:
  date: 2026-11-04
  oldest: 2026-11-04
  commit: "11f9913"
  result: passed
  report: _runs/2026-11-04-2138-health.check-database.md
  runs:
    r1: { date: 2026-11-04, commit: "11f9913", report: _runs/2026-11-04-2138-health.check-database.md }
  cells:
    S01: passed r1
    S02: passed r1
    S03: passed r1
---

# The API reports whether it can reach the database

---

## Goal

Prove that `GET /health` answers 200 with `status: ok` when the database answers `SELECT 1`, and 503 when the query fails or takes longer than 2 seconds, so a probe never hangs on a frozen database.

---

## Preconditions

- Test environment: Postgres up (`docker compose up -d db`) and `api/.env` copied from `api/.env.example`. The script boots the real `AppModule` (`api/src/app.module.ts`), which runs its migrations on start, calls `app.listen(0)` once and sends requests with Node's built-in `fetch`. Run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`.
- Auth: none. Authentication is out of scope (PRD), and `api/openapi.yaml` declares `security: []`.
- Data: none. The endpoint reads no table.
- Database failure (S02, S03): the script replaces the answer of the booted app's TypeORM `DataSource.query` with `vi.spyOn(dataSource, 'query')`, taking the `DataSource` from the app (`app.get(DataSource)`). The HTTP stack, the controller and Nest's exception layer still run. The spy is restored after each test (`vi.restoreAllMocks()` in `afterEach`).

---

## Steps

### S01. The API reports ok when the database answers

Parents: none
Requirement: none
Endpoint: `GET /health`
As: anonymous
Request:

```http
GET /health
```

Expected: 200.

```json
{ "status": "ok" }
```

The body has no other keys.

---

### S02. The API answers 503 when the database query fails

Parents: none
Requirement: none
Endpoint: `GET /health`
As: anonymous
Request:

```http
GET /health
```

Before the call, the app's `DataSource.query` rejects with an error (the database cannot be reached), as Preconditions say.

Expected: 503.

```json
{ "message": "Service Unavailable", "statusCode": 503 }
```

---

### S03. The API answers 503 after 2 seconds when the database does not answer

Parents: none
Requirement: none
Endpoint: `GET /health`
As: anonymous
Request:

```http
GET /health
```

Before the call, the app's `DataSource.query` returns a promise that never settles (a frozen database), as Preconditions say.

Expected: 503.

```json
{ "message": "Service Unavailable", "statusCode": 503 }
```

The response arrives no sooner than 2000 ms after the request was sent, and within the test's timeout, instead of hanging.

---

## Not covered

- Invalid input (422): the endpoint takes no query, path parameter or body.
- A role that must not get in (403) and no authentication (401): authentication is out of scope (PRD; `api/openapi.yaml` `security: []`).
- Read-back: the endpoint is read-only and writes nothing.
- A real Postgres outage or freeze: the script cannot stop or pause the shared docker compose database, so S02 and S03 simulate it on the app's `DataSource`.
- Database down when the API starts: the API does not start (TypeORM `retryAttempts: 3` with `migrationsRun: true`, `api/src/database/database.module.ts`), so `GET /health` never answers. That belongs to startup, not to this endpoint.

---

## Cleanup

- Nothing to undo: no step writes data. The `DataSource.query` spy is restored after each test, and the app is closed in `afterAll`.
