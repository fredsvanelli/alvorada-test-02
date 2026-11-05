# SCH-8 Cancel and List Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /bookings/:id/cancel` and `GET /bookings`, with every booking response nesting `resource: { id, name }` (create included).

**Architecture:** A `BookingView` response type sits next to the `Booking` storage entity. `BookingsRepository` reads views with one SQL `JOIN` on `resource` (list and cancel); create builds its view from `ResourcesService.findById`. `BookingsService` gains `list()` and `cancel()`; `BookingsController` only maps results to HTTP.

**Tech Stack:** Nest.js 11, TypeORM, Postgres 16, Vitest (globals), oxlint.

**Spec:** `docs/superpowers/specs/2026-11-05-sch-8-cancel-and-list-design.md`

## Global Constraints

- Booking response shape, everywhere: `{ id, resource: { id, name }, start, end, status }`, `start`/`end` as JSON numbers. Requests are unchanged (`"resource": "R1"`, `?resource=R1`); `conflicts` stays a list of ids.
- Cancel: id fails `^[A-Za-z0-9_-]{1,64}$` → 404 `not_found` with no database call; unknown id → 404 `not_found`; Canceled → 200 `{ result: "already_canceled", booking }`, nothing written; Active → `UPDATE status = 'canceled'`, 200 `{ result: "canceled", booking }` with `booking.status = "canceled"`. Never deletes. Request body ignored.
- `not_found` message, verbatim: `No booking has this id.`
- `GET /bookings`: no params, bare array, ascending id by `COLLATE "C"` (`10`, `9`, `B`, `a`), `[]` when empty.
- Commits are conventional and end with `(SCH-8)`. Every endpoint change updates `api/openapi.yaml` in the same commit; lint with `npx @redocly/cli lint api/openapi.yaml`.
- Runbooks are the source of truth: change scripts to match Expected, never the reverse. Scripts follow CLAUDE.md "API scripts".
- Run from the repo root; Postgres must be up (`docker compose up -d db`) for `npm test`.

## Review Focus

1. `POST /bookings/:id/cancel` answers 200, not Nest's POST default 201. Unit tests cannot see `@HttpCode`; the cancel runbook asserts the status (Task 3, S01 and S02).
2. Cancel id `R%00` (NUL) → 404 `not_found`, never a 500 from Postgres. Service test in Task 3.
3. Cancel `a` when only `A` exists → 404 `not_found` (case-sensitive). Runbook step in Task 3.
4. `GET /bookings` order against real Postgres (the database's `en_US` collation would put `a` before `B`). Runbook step in Task 2.
5. Raw SQL returning `start`/`end` as strings, or the `JOIN` dropping or duplicating rows. Runbook steps in Tasks 2 and 3 compare whole bodies with strict equality.

---

### Task 0: Commit the design inputs

- [ ] **Step 1:** Commit `GLOSSARY.md`, `docs/adr/0001-nested-resource-in-booking-responses.md`, the spec, this plan, and the tracker changes under `.issues/issues/SCH-7/` and `.issues/issues/SCH-8/`: `docs: add SCH-8 cancel and list design and plan (SCH-8)`.

### Task 1: Nest the resource in the create response

**Files:**
- Modify: `api/src/bookings/booking.entity.ts`, `api/src/resources/resources.service.ts`, `api/src/bookings/bookings.service.ts`, `api/src/bookings/bookings.controller.ts`, `api/openapi.yaml`, `docs/runbooks/bookings/create-booking.md` (via `/runbooks:update`), `api/test/runbooks/bookings-create-booking.spec.ts`
- Test: `api/src/resources/resources.service.spec.ts`, `api/src/bookings/bookings.service.spec.ts`, `api/src/bookings/bookings.controller.spec.ts`

**Interfaces:**
- Produces, in `booking.entity.ts` (replace the "a Booking is also the response body" comment: `Booking` is the stored row, `BookingView` the response):
  ```ts
  export type BookingView = {
    id: string;
    resource: { id: string; name: string };
    start: number;
    end: number;
    status: BookingStatus;
  };
  ```
- `ResourcesService.findById(id: string): Promise<Resource | null>` (`findOneBy({ id })`). `exists` stays for availability.
- `CreateResult` success becomes `{ ok: true; booking: BookingView }`. `BookingsController.create` returns `Promise<BookingView>`.

- [ ] **Step 1: Write the failing tests**
  - `resources.service.spec.ts`: add `findOneBy` to the mocked repository; `it('finds a resource by id')`: `findOneBy` → `{ id: 'R1', name: 'Agora Room' }`; `findById('R1')` resolves to it; called with `{ id: 'R1' }`. `it('returns null for an unknown id')`.
  - `bookings.service.spec.ts`: mock `ResourcesService` as `{ exists, findById: findResource }` with `findResource` defaulting to `{ id: 'R1', name: 'Agora Room' }`. `creates an active booking` now expects `booking: { id: 'A', resource: { id: 'R1', name: 'Agora Room' }, start: 10, end: 20, status: 'active' }` and `insert` still called with the flat row `{ ...valid, status: 'active' }`. Create's `unknown_resource`, `passes resource unchanged` and `checks in order` tests switch from `exists` to `findResource` (→ `null`). Availability tests keep `exists`.
  - `bookings.controller.spec.ts`: `returns the created booking` uses a nested `booking`.
- [ ] **Step 2:** Run `npm test -w api -- resources.service bookings.service bookings.controller`. Expected: FAIL.
- [ ] **Step 3:** Implement: `create` calls `this.resources.findById(booking.resource)` for the `unknown_resource` check and returns `{ ...booking, resource: { id: resource.id, name: resource.name } }`; check order unchanged; `insert` still gets the flat `Booking`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** `api/openapi.yaml`: `Booking.resource` becomes `$ref: '#/components/schemas/Resource'`; the 201 example nests `{ id: R1, name: Agora Room }`. Lint.
- [ ] **Step 6:** Run `/runbooks:update bookings.create-booking`: every expected 201 body nests `"resource": { "id": "R1", "name": "Agora Room" }` (or the step's resource), "exactly these five keys" still holds; update the script to match. Run `npm test -w api -- bookings-create-booking`. Expected: PASS.
- [ ] **Step 7:** Commit: `feat: nest the resource in the create booking response (SCH-8)`.

### Task 2: `GET /bookings`

**Files:**
- Modify: `api/src/bookings/bookings.repository.ts`, `api/src/bookings/bookings.service.ts`, `api/src/bookings/bookings.controller.ts`, `api/openapi.yaml`
- Create: `docs/runbooks/bookings/list-bookings.md` (via `/runbooks:create`), `api/test/runbooks/bookings-list-bookings.spec.ts` (via `/runbooks:to-test`)
- Test: `api/src/bookings/bookings.service.spec.ts`, `api/src/bookings/bookings.controller.spec.ts`

**Interfaces:**
- Consumes: `BookingView` (Task 1).
- Produces:
  - `BookingsRepository.findAllWithResource(): Promise<BookingView[]>` and `findByIdWithResource(id: string): Promise<BookingView | null>`, both from one private query that maps rows to `BookingView`:
    ```sql
    SELECT b.id, b.start_time, b.end_time, b.status, r.id AS resource_id, r.name AS resource_name
    FROM booking b JOIN resource r ON r.id = b.resource_id
    [WHERE b.id = $1]
    ORDER BY b.id COLLATE "C"
    ```
    via `this.bookings.query(sql, params)`. `integer` columns arrive as numbers from `pg`; keep the mapping explicit anyway (`start: row.start_time`).
  - `BookingsService.list(): Promise<BookingView[]>` returns `findAllWithResource()` as is.
  - `@Get('bookings') list(): Promise<BookingView[]>`.

- [ ] **Step 1: Write the failing tests**
  - Service `describe('list')`: `it('returns the repository views in its order')`: `findAllWithResource` → views `10`, `9`, `B`, `a`; `list()` resolves `toStrictEqual` the same array.
  - Controller `it('lists bookings')`: service `list` → `[view]`; `controller.list()` resolves `toBe` that array.
- [ ] **Step 2:** Run `npm test -w api -- bookings.service bookings.controller`. Expected: FAIL.
- [ ] **Step 3:** Implement the repository query, `list()` and the route.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** `api/openapi.yaml`: `/bookings` `get` (`operationId: listBookings`), 200 array of `Booking`, description: every booking, active and canceled, ascending id order by character code, no params, unknown ones ignored. Lint.
- [ ] **Step 6:** `/runbooks:create` flow `bookings.list-bookings`, surface `api`, `covers.entries: ["GET /bookings"]`, `sources: [spec path]`:
  - S01 empty table → 200 `[]`.
  - S02 A R1 `[10,20)` and B R2 `[10,20)` created → 200 with exactly two items, each nested resource with its seeded name, status `active`, `start`/`end` numbers.
  - S03 ids `B`, `a`, `10`, `9` created in that order on R1 with disjoint intervals → ids come back `["10","9","B","a"]`.
  (Active and Canceled together is added in Task 3, once cancel exists.)
  Then `/runbooks:to-test bookings.list-bookings`; run `npm test -w api -- bookings-list-bookings`. Expected: 3 PASS.
- [ ] **Step 7:** Commit: `feat: add GET /bookings endpoint (SCH-8)`.

### Task 3: `POST /bookings/:id/cancel`

**Files:**
- Modify: `api/src/bookings/bookings.repository.ts`, `api/src/bookings/bookings.service.ts`, `api/src/bookings/bookings.controller.ts`, `api/openapi.yaml`, `docs/runbooks/bookings/list-bookings.md` and its script (via `/runbooks:update`)
- Create: `docs/runbooks/bookings/cancel-booking.md` (via `/runbooks:create`), `api/test/runbooks/bookings-cancel-booking.spec.ts` (via `/runbooks:to-test`)
- Test: `api/src/bookings/bookings.service.spec.ts`, `api/src/bookings/bookings.controller.spec.ts`

**Interfaces:**
- Consumes: `findByIdWithResource` (Task 2), the module-level `ID` regex in `bookings.service.ts`.
- Produces:
  - `BookingsRepository.setStatus(id: string, status: BookingStatus): Promise<void>` (`update({ id }, { status })`).
  - ```ts
    export type CancelResult =
      | { ok: true; result: 'canceled' | 'already_canceled'; booking: BookingView }
      | { ok: false; error: 'not_found' };
    cancel(id: string): Promise<CancelResult>
    ```
  - `@Post('bookings/:id/cancel') @HttpCode(200) cancel(@Param('id') id: string): Promise<{ result: 'canceled' | 'already_canceled'; booking: BookingView }>`; `not_found` throws `HttpException({ error: 'not_found', message: 'No booking has this id.' }, 404)`. Widen the controller's status/message maps to include `not_found`.

- [ ] **Step 1: Write the failing tests**
  - Service `describe('cancel')`, with `findByIdWithResource` and `setStatus` added to the repository mock:
    - `it('cancels an active booking')`: repo → active view of A; `cancel('A')` → `{ ok: true, result: 'canceled', booking: { ...view, status: 'canceled' } }`; `setStatus` called once with `('A', 'canceled')`.
    - `it('answers already_canceled without writing')`: repo → canceled view; result `already_canceled` with that view; `setStatus` not called.
    - `it('returns not_found for an unknown id')`: repo → `null`; `{ ok: false, error: 'not_found' }`; `setStatus` not called.
    - `it.each(['a'.repeat(65), 'R\u00001', 'A B', ''])('returns not_found for %j without a query')`: `findByIdWithResource` not called.
  - Controller: `it.each(['canceled', 'already_canceled'])('returns %s with the booking')` → resolves `toStrictEqual({ result, booking })`, service called with `'A'`; `it('maps not_found to 404')` → `getStatus()` 404, `getResponse()` `toStrictEqual({ error: 'not_found', message: 'No booking has this id.' })`.
- [ ] **Step 2:** Run `npm test -w api -- bookings.service bookings.controller`. Expected: FAIL.
- [ ] **Step 3:** Implement `setStatus`, `cancel` (pattern check → `findByIdWithResource` → status branch → `setStatus` only when active) and the route.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** `api/openapi.yaml`: `/bookings/{id}/cancel` `post` (`operationId: cancelBooking`, path param `id`), 200 → new `CancelResult` schema (`required: [result, booking]`, `result` enum `[canceled, already_canceled]`, `booking` `$ref Booking`) with both examples; 404 → `BookingError` (`not_found` example; description notes an empty id or one with `/` gets Nest's default 404 body). Add `not_found` to the `BookingError` enum. Lint.
- [ ] **Step 6:** `/runbooks:create` flow `bookings.cancel-booking`, surface `api`, `covers.entries: ["POST /bookings/:id/cancel"]`, `sources: [spec path]`:
  - S01 A R1 `[10,20)`; cancel A → 200 `{ result: "canceled", booking: { id: "A", resource: { id: "R1", name: "Agora Room" }, start: 10, end: 20, status: "canceled" } }`; read-back `GET /bookings` shows A `canceled`.
  - S02 A canceled; cancel A again → 200 `already_canceled` with the same booking; `GET /bookings` unchanged.
  - S03 cancel `Z` (never created) → 404 `{ error: "not_found", message: <string> }`.
  - S04 A created; cancel `a` → 404 `not_found`; `GET /bookings` shows A still `active`.
  - S05 A R1 `[10,20)` canceled; `POST /bookings` C R1 `[10,20)` → 201.
  - S06 A R1 `[10,20)` canceled; `POST /bookings` A R1 `[30,40)` → 409 `id_taken`.
  Then `/runbooks:to-test bookings.cancel-booking`; run `npm test -w api -- bookings-cancel-booking`. Expected: 6 PASS.
- [ ] **Step 7:** `/runbooks:update bookings.list-bookings`: add S04, A R1 `[10,20)` canceled and B R1 `[20,30)` active → both listed, A `canceled`, B `active`. Update the script; run it. Expected: 4 PASS.
- [ ] **Step 8:** Commit: `feat: add POST /bookings/:id/cancel endpoint (SCH-8)`.

### Task 4: Close the availability runbook gaps

**Files:**
- Modify: `docs/runbooks/bookings/check-availability.md` (via `/runbooks:update`), `api/test/runbooks/bookings-check-availability.spec.ts`, `docs/runbooks/bookings/create-booking.md` ("Not covered" only)

- [ ] **Step 1:** `/runbooks:update bookings.check-availability`: add
  - S07 A R1 `[10,20)` and B R1 `[20,30)`; `GET /bookings` before and after `GET /availability?resource=R1&start=19&end=21` are equal.
  - S08 A R1 `[10,20)` canceled via `POST /bookings/A/cancel`; `GET /availability?resource=R1&start=10&end=20` → 200 `{ available: true, conflicts: [] }`.
  Remove both entries from "Not covered". Update the script; run `npm test -w api -- bookings-check-availability`. Expected: 8 PASS.
- [ ] **Step 2:** In `bookings.create-booking` "Not covered", replace the canceled-booking entry with a pointer to `bookings.cancel-booking` S05 and S06 (via `/runbooks:update`).
- [ ] **Step 3:** Commit: `test: cover cancel in the availability and create runbooks (SCH-8)`.

### Task 5: Close out

- [ ] **Step 1:** Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Expected: all pass.
- [ ] **Step 2:** Run `/runbooks:list --affected`, then `/runbooks:run --affected` (expect create, list, cancel and check-availability). Expected: all passed.
- [ ] **Step 3:** Commit the runbook run records: `chore: record SCH-8 runbook runs (SCH-8)`.
- [ ] **Step 4:** Run `/utils:review-work --base main --spec .issues/issues/SCH-8/issue.md`; fix findings or list the ones left open with a reason.
