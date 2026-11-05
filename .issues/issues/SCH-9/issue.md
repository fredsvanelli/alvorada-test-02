---
id: SCH-9
title: Add an API e2e test that replays the PRD example
type: task
status: canceled
estimate: 3
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-6, SCH-7, SCH-8]
created: 2026-11-04T20:00:44.778Z
updated: 2026-11-05T17:53:07Z
---

## Acceptance criteria

- [ ] An e2e test over HTTP against Postgres creates A on R1 `[10,20)` and B on R1 `[20,30)`, both accepted
- [ ] C on R1 `[19,21)` is rejected with `conflict` A, B, then C on R2 `[19,21)` is accepted
- [ ] Availability for R1 `[19,21)` returns the conflicts A, B
- [ ] After canceling A, R1 is available for `[10,20)` and creating a new booking with id A returns `id_taken`
- [ ] The test starts from a clean database, runs with a documented npm script, and test, lint, typecheck and build pass

## Description

### Context

Seventh step of SCH-2, blocked by SCH-6, SCH-7 and SCH-8. The unit tests of those issues mock the database. This issue checks the whole API over HTTP against the real Postgres, by replaying the example from the PRD ("An example": A, B, C on R1 and R2). The PRD asks for this example to run as an automated test (SCH-2), and the README (SCH-11) can point to it as a highlighted test.

### Scope (in)

- One e2e spec that boots the Nest app against the Docker Postgres and calls it over HTTP, in this order:
  - A on R1 `[10,20)` accepted, B on R1 `[20,30)` accepted
  - C on R1 `[19,21)` rejected with `conflict` A, B, then C on R2 `[19,21)` accepted
  - Availability for R1 `[19,21)` returns the conflicts A, B
  - Cancel A, then R1 is available for `[10,20)`, and a new booking with id A returns `id_taken`
- A clean `booking` table before the run, so the test can be repeated
- An npm script that runs it from the repo root, documented in `CLAUDE.md`

### Out of scope

- More e2e cases beyond the PRD example: the unit tests of SCH-5 to SCH-8 cover the edge cases
- A browser test of the web app (SCH-10)
- Running the tests in CI

### Open questions for the design step

- HTTP client: add `supertest`, or use the built-in `fetch` against `app.listen(0)`?
- Clean data: truncate `booking` before the run, a separate test database, or a transaction rolled back after?
- Should `npm test` keep running unit tests only (no Docker needed), with the e2e under its own script such as `npm run test:e2e`? Today the Vitest config picks up every `*.spec.ts`
