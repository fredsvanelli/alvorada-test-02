# SCH-7 Check Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /availability?resource=&start=&end=` answers `{ available, conflicts }` from the same conflict lookup as create, and writes nothing.

**Architecture:** `BookingsService` gains `availability()` and a private `findConflicts()` that `create()` also uses; resource validation moves into a shared `isResourceId()`. `BookingsController` becomes `@Controller()` so it serves both `/bookings` and `/availability`, and only maps results to HTTP.

**Tech Stack:** Nest.js 11, TypeORM, Postgres 16, Vitest (globals), oxlint.

**Spec:** `docs/superpowers/specs/2026-11-04-sch-7-check-availability-design.md`

## Global Constraints

- 200 body is exactly `{ available: boolean, conflicts: string[] }`; `available === (conflicts.length === 0)`; 200 even when not available.
- `conflicts` are ids in the order `findActiveByResource` returns them (`COLLATE "C"`); the service never re-sorts.
- Check order: `invalid_data` (422) → `unknown_resource` (404) → conflict lookup.
- Availability `invalid_data` message, verbatim: `Send resource, and integer start and end from 0 to 2147483647 with start before end.`
- `unknown_resource` message unchanged: `This resource does not exist.`
- Error body `{ error, message }`, no `conflicts` key on availability errors.
- Commits are conventional and end with `(SCH-7)`. Every endpoint change updates `api/openapi.yaml` in the same commit.
- Run from the repo root; Postgres must be up (`docker compose up -d db`) for `npm test`.

## Review Focus

1. Repeated `resource` (`?resource=R1&resource=R2`) arrives as an array → `invalid_data`, not a 500. Test in Task 2.
2. Repeated `start` (`?start=1&start=2`) → `invalid_data`. Test in Task 2.
3. Empty `start=` (empty string) → `invalid_data`. Test in Task 2.
4. `resource=r1` (wrong case) → `unknown_resource`, exact match. Test in Task 2.
5. Moving `@Controller('bookings')` to `@Controller()` must keep `POST /bookings` at the same path. Covered by the `bookings.create-booking` runbook in Task 4.

---

### Task 1: Extract `isResourceId` and `findConflicts` (refactor, no behavior change)

**Files:**
- Modify: `api/src/bookings/bookings.service.ts`
- Test: `api/src/bookings/bookings.service.spec.ts` (existing tests, unchanged)

**Interfaces:**
- Produces: module-level `function isResourceId(value: unknown): value is string` (string, not `''`, no `'\u0000'`; keep the NUL comment). Private `findConflicts(resource: string, interval: Interval): Promise<string[]>` on `BookingsService`: `findActiveByResource(resource)` → `filter(overlaps(interval, b))` → `map(b => b.id)`.

- [ ] **Step 1:** Replace the inline resource checks in `parseBooking` with `!isResourceId(resource)`, and the inline lookup in `create()` with `await this.findConflicts(booking.resource, booking)`. Import `Interval` from `./booking-rules.js`.
- [ ] **Step 2:** Run `npm test -w api -- bookings.service`. Expected: all existing tests PASS.
- [ ] **Step 3:** Commit: `refactor: share the conflict lookup and resource check in BookingsService (SCH-7)`.

### Task 2: `BookingsService.availability`

**Files:**
- Modify: `api/src/bookings/bookings.service.ts`
- Test: `api/src/bookings/bookings.service.spec.ts` (new `describe('availability')`, reusing the file's mocks and `booking()` helper)

**Interfaces:**
- Consumes: `isResourceId`, `findConflicts` (Task 1), `parseInterval`.
- Produces:
  ```ts
  export type AvailabilityError = 'invalid_data' | 'unknown_resource';
  export type AvailabilityResult =
    | { ok: true; available: boolean; conflicts: string[] }
    | { ok: false; error: AvailabilityError };
  availability(resource: unknown, start: unknown, end: unknown): Promise<AvailabilityResult>
  ```

- [ ] **Step 1: Write the failing tests**
  - `it('is available when nothing overlaps')`: `findActiveByResource` → `[]`; `availability('R1', 10, 20)` → `{ ok: true, available: true, conflicts: [] }`; `findActiveByResource` called with `'R1'`.
  - `it('lists the overlapping bookings in repository order')`: repo → `[booking('A',10,20), booking('B',20,30)]`; `availability('R1','19','21')` → `{ ok: true, available: false, conflicts: ['A','B'] }`.
  - `it('keeps the order the repository returns')`: repo → `[booking('10',0,5), booking('9',0,5), booking('B',0,5), booking('a',0,5)]`; `availability('R1',0,5)` → `conflicts: ['10','9','B','a']`.
  - `it('treats [20,30) after [10,20) as available')`: repo → `[booking('A',10,20)]`; `availability('R1',20,30)` → `available: true`.
  - `it('never writes')`: after the not-available case above, `expect(insert).not.toHaveBeenCalled()`.
  - `it.each` invalid inputs → `{ ok: false, error: 'invalid_data' }` and `exists` not called: `[undefined,10,20]`, `['',10,20]`, `[['R1','R2'],10,20]`, `['R\u00001',10,20]`, `['R1',undefined,20]`, `['R1','',20]`, `['R1',['1','2'],20]`, `['R1','abc',20]`, `['R1','1.5',20]`, `['R1','-1',20]`, `['R1',0,2147483648]`, `['R1',10,10]`, `['R1',20,10]`.
  - `it('rejects an unknown resource')`: `exists` → `false`; `availability('r1',10,20)` → `{ ok: false, error: 'unknown_resource' }`; `findActiveByResource` not called.
- [ ] **Step 2:** Run `npm test -w api -- bookings.service`. Expected: FAIL, `availability is not a function`.
- [ ] **Step 3:** Implement `availability` in `bookings.service.ts`: `isResourceId` + `parseInterval` → `invalid_data`; `this.resources.exists` → `unknown_resource`; then `findConflicts`. Comment that it is read-only.
- [ ] **Step 4:** Run `npm test -w api -- bookings.service`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: check availability in BookingsService (SCH-7)`.

### Task 3: `GET /availability` route and OpenAPI

**Files:**
- Modify: `api/src/bookings/bookings.controller.ts`, `api/openapi.yaml`
- Test: `api/src/bookings/bookings.controller.spec.ts` (add `availability` to the mocked service)

**Interfaces:**
- Consumes: `BookingsService.availability`, `AvailabilityResult`, `AvailabilityError` (Task 2).
- Produces: `@Get('availability') availability(@Query('resource') resource: unknown, @Query('start') start: unknown, @Query('end') end: unknown): Promise<{ available: boolean; conflicts: string[] }>`. Controller decorator becomes `@Controller()`, `create` becomes `@Post('bookings')`.

- [ ] **Step 1: Write the failing tests**
  - `it('returns available and conflicts')`: service → `{ ok: true, available: false, conflicts: ['A','B'] }`; `controller.availability('R1','19','21')` resolves `toStrictEqual({ available: false, conflicts: ['A','B'] })`; service called with `('R1','19','21')`.
  - `it.each([['invalid_data',422],['unknown_resource',404]])('maps availability %s to %i')`: thrown `HttpException` with that status and `getResponse()` `toStrictEqual({ error: code, message: expect.any(String) })`.
  - `it('asks for resource, start and end on invalid_data')`: message equals the Global Constraints string exactly.
- [ ] **Step 2:** Run `npm test -w api -- bookings.controller`. Expected: FAIL.
- [ ] **Step 3:** Implement. Reuse `STATUS`; add an `AVAILABILITY_MESSAGE: Record<AvailabilityError, string>` with the availability `invalid_data` text and `MESSAGE.unknown_resource`.
- [ ] **Step 4:** In `api/openapi.yaml` add `/availability` `get` (`operationId: checkAvailability`, query params `resource`, `start`, `end` all required, `start`/`end` as `type: string, pattern: '^\d+$'`), responses `200` → new `Availability` schema (`required: [available, conflicts]`, `conflicts` ids in ascending id order by character code; example `{ available: false, conflicts: [A, B] }`), `404` and `422` → `BookingError` with examples using the messages above. Description: read-only, writes nothing, extra params ignored.
- [ ] **Step 5:** Run `npm test -w api -- bookings.controller` and `npx @redocly/cli lint api/openapi.yaml`. Expected: PASS, lint with no errors.
- [ ] **Step 6:** Commit: `feat: add GET /availability endpoint (SCH-7)`.

### Task 4: Runbook `bookings.check-availability`

**Files:**
- Create: `docs/runbooks/bookings/check-availability.md` (via `/runbooks:create`), `api/test/runbooks/bookings-check-availability.spec.ts` (via `/runbooks:to-test`)

**Interfaces:**
- Consumes: `POST /bookings` (to set up Given bookings) and `GET /availability`.

- [ ] **Step 1:** Run `/runbooks:create` for flow `bookings.check-availability`, surface `api`, `covers.entries: ["GET /availability"]`, `sources: [spec path]`. Steps, in order:
  - S01 R1 `[19,21)` after A R1 `[10,20)` and B R1 `[20,30)` → 200 `{ available: false, conflicts: ["A","B"] }`.
  - S02 R1 `[30,40)` after A and B → 200 `{ available: true, conflicts: [] }`.
  - S03 R2 `[10,20)` with A only on R1 → 200 available.
  - S04 active R1 bookings `B`, `a`, `10`, `9` all `[0,5)`; check R1 `[0,5)` → `conflicts: ["10","9","B","a"]`.
  - S05 `invalid_data` 422: `start=abc`, `start=20&end=10`, missing `resource`, repeated `resource`.
  - S06 `unknown_resource` 404: `resource=R9`.
- [ ] **Step 2:** Run `/runbooks:to-test bookings.check-availability`. The script follows CLAUDE.md "API scripts" (real `AppModule`, `listen(0)`, `beforeEach` empties `booking`, built-in `fetch`, test names start with the step id).
- [ ] **Step 3:** Run `npm test -w api -- bookings-check-availability`. Expected: 6 PASS.
- [ ] **Step 4:** Commit: `test: add bookings.check-availability runbook and script (SCH-7)`.

### Task 5: Close out

- [ ] **Step 1:** Write the SCH-8 note to a scratchpad file: SCH-8 adds two steps to `bookings.check-availability`, (1) a check followed by `GET /bookings` shows the bookings unchanged, (2) a canceled booking no longer conflicts. Post with `pmkit issues comment SCH-8 --body-file <file>` after a `--dry-run` preview and the user's OK.
- [ ] **Step 2:** Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Expected: all pass.
- [ ] **Step 3:** Run `/runbooks:list --affected`, then `/runbooks:run --affected` (expect `bookings.check-availability` and `bookings.create-booking`). Expected: all passed.
- [ ] **Step 4:** Commit the runbook run records and the SCH-6 tracker sync left over from `main`: `chore: record SCH-7 runbook runs and SCH-6 sync (SCH-7)`.

> Before Task 1, commit the design inputs on their own: `GLOSSARY.md`, the spec and this plan, as `docs: add SCH-7 availability design and plan (SCH-7)`.
