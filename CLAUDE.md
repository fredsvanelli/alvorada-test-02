# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A booking system for shared resources that rejects overlapping bookings. The spec is `.issues/docs/PRD.md`. The agreed design is `docs/diagrams/architecture.md`. Read both before changing behavior.

Planned stack: Next.js (TypeScript, Tailwind, shadcn/ui) → Nest.js REST API (TypeScript) → Postgres 16 in Docker (`docker compose up -d db`, localhost:5432). Only Postgres runs in Docker.

## Commands

npm workspaces: `api/` (Nest.js, Vitest, oxlint) and `web/` (Next.js, ESLint). Run everything from the repo root.

- One-time setup: `cp api/.env.example api/.env`, `npm install`, `docker compose up -d db`. Compose reads the Postgres credentials from `api/.env` too.
- Run: `npm run dev:api` (port 3001, `GET /health` checks the database) and `npm run dev:web` (port 3000).
- Check: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
- Single test: `npm test -w api -- -t "<test name>"`, or `npm test -w api -- <file filter>`.
- Adding a dependency: npm 10 crashes on this workspace (`Cannot read properties of null (reading 'edgesOut')`). Use `npx npm@11 install -w <api|web> <pkg>`. `npm ci` works with npm 10.

## Domain rules (from the PRD, easy to get wrong)

- Intervals are half-open `[start, end)`: a booking `[10,20)` frees the resource at 20, so `[20,30)` is accepted. Time is plain non-negative integers within Postgres `integer` (`0..2147483647`), with `start < end`.
- Overlap only counts **active** bookings of the **same** resource.
- The client chooses the booking id. A **rejected** attempt writes no row, so its id stays free. A **created** booking's id is never reused, even after cancellation (cancel sets `status = canceled` and keeps the row).
- Availability check is read-only and returns conflicts in **ascending id** order.
- Canceling an already canceled booking returns `already_canceled` and changes nothing.
- Error codes: `invalid_data` (422), `unknown_resource` (404), `id_taken` (409), `conflict` (409, with conflicting ids), `not_found` (404), `already_canceled` (200).
- Out of scope: payment, recurrence, auth, concurrency.

## Backend shape (planned)

- The `[start, end)` rule lives in one place: pure functions `parseInterval(start, end)` (returns `Interval | null`; accepts integers or digit-only strings in `0..2147483647` with `start < end`, and `null` means `invalid_data`) and `overlaps(a, b)` (`a.start < b.end && b.start < a.end`) in `booking-rules.ts`. `BookingsService` uses them for both create and availability.
- Controllers only map HTTP to service calls and results to status codes.
- Modules: `ResourcesModule` (`GET /resources`, seeded R1 to R5), `BookingsModule` (`POST /bookings`, `GET /bookings`, `GET /availability`, `POST /bookings/:id/cancel`, `BookingsRepository`), `DatabaseModule`.
- Create checks in this order: invalid_data → unknown_resource → id_taken → conflict → insert.

## API contract

`api/openapi.yaml` (OpenAPI 3.1) is the contract for every HTTP endpoint. Whenever you create, change or remove an endpoint, update it in the same commit. "Change" includes the path, method, query or path params, request body, response body, status codes and error codes. Validate it with `npx @redocly/cli lint api/openapi.yaml`.

## Design reference

`.design/prototype-html/Main.dc.html` (plus `.design/prototype.pdf`) is a UI mockup exported from a design tool. Replicate its colors, spacing and layout in shadcn/Tailwind components. Don't copy its markup or runtime. To view it, serve the folder (`python3 -m http.server`) and open `Main.dc.html`.

## Workflow

- Work is tracked with pmkit in `.issues/` (prefix `SCH-`, config in `.pmkit/config.yaml`, GitHub repo `fredsvanelli/alvorada-test-02`, default branch `main`). SCH-2 is the parent feature. SCH-3 to SCH-11 are its sub-issues, and their `blocked_by` sets the order. Use the `pmkit` skill or the `/pmkit:issues:*` commands rather than editing `.issues/` files by hand.
- One branch per issue, created by pmkit (`sch-<n>-<slug>`).
- Commit messages are conventional commits ending with the issue ID, for example `feat: add availability endpoint (SCH-7)`.

### Overrides to `/pmkit:issues:work`

Follow the pmkit steps as written, with these changes:

1. **Plan (step 7):** don't write the plan directly. Stop and ask the user to run `/mattpocock-skills:grill-with-docs` on the issue, because that skill can't be invoked by the model. Wait for the document it produces (ADRs, glossary, sharpened spec).
2. **Design:** feed that document into `/superpowers:brainstorming`. Its output becomes the implementation plan that step 7 shows, asks about and optionally posts as a comment.
3. **Implement (step 8)** using the `superpowers` workflows
4. **Review before the PR (before step 9):** run `/utils:review-work --base main --spec .issues/issues/<issue id>/issue.md` on the branch. Fix the findings, or list the ones left open with a reason, before asking to open the PR.

- The final README must cover setup, run, tests, a reproducible demo, two decisions, up to three highlighted tests and what is left (SCH-11, PRD "What to deliver").
<!-- runbooks:start -->
## Runbooks

UAT runbooks in `docs/runbooks/` are the official record of how the product behaves. Read `docs/runbooks/README.md` before editing one. Commands below use Claude notation; in Codex use `$runbooks:runbooks-<command>` (replace further colons with hyphens), or ask the `$runbooks:runbooks` skill to perform that operation.

- Feature work creates or updates the runbook of every flow it changes (`/runbooks:create` for a new flow, `/runbooks:update` for one that has a runbook).
- Before calling work done, run `/runbooks:list --affected`, then `/runbooks:run --affected`. A failing runbook means the work is not done.
- `ui` runbook results are verified in the browser, or by their script in mode `test` when the script has one test per step. The agent calls only the upstream server's control routes, which verify nothing. `api` runbook results are verified only by their scripts (the files in `scripts:`), run with the project's test command.

### API scripts

How this project's `api` runbook scripts are written. `to-test` follows it; `setup` rewrites it. No `api` runbook script exists yet, so this is the usual Nest + Vitest practice; the first `to-test` settles it.

- Library and command: Vitest, run from `api/` with `npx vitest run {files} --reporter=junit --outputFile={junit}`. Scripts live in `api/test/runbooks/*.spec.ts`; `vitest.config.ts` includes `**/*.spec.ts`, so `npm test` runs them too and needs Postgres up (`docker compose up -d db`).
- Naming: one test per runbook step, its name starting with the step id (`it('S2 rejects an overlapping booking with conflict', ...)`). Tests without a step prefix belong to the project, not to a runbook.
- Isolation: each file boots the real `AppModule` (`api/src/app.module.ts`) with `Test.createTestingModule({ imports: [AppModule] })`, calls `app.listen(0)` once, and closes it in `afterAll`. `beforeEach` empties the `booking` table through the app's TypeORM `DataSource`.
- Test database: specs never touch the dev database `bookings`. `vitest.config.ts` sets `POSTGRES_DB=bookings_test` (process env wins over `api/.env`), and `api/test/global-setup.ts` drops, recreates and migrates `bookings_test` in the docker compose Postgres before every Vitest run. It refuses a name that does not end in `_test`.
- Data: resources R1 to R5 come from the migration seed (`api/src/database/migrations/1793750400000-InitSchema.ts`), applied by the global setup. Bookings are created in the test through `POST /bookings`, with ids chosen by the test.
- Auth: none; authentication is out of scope (PRD).
- Requests: Node's built-in `fetch` against the listening app's URL; no supertest.
- Assertions: status first, then the body fields the step names (error `code`, conflicting ids in ascending order), then effects through a read-back call (`GET /bookings`, `GET /availability`). There are no side effects without an endpoint.
- External services: none exist.
- The runbook is the source of truth: change the script to match its Expected, never the other way round without asking.
<!-- runbooks:end -->
