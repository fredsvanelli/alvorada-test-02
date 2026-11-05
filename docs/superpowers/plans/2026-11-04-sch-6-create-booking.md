# SCH-6 Create a Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /bookings` creates an active booking or rejects it with `invalid_data`, `unknown_resource`, `id_taken` or `conflict`, writing nothing on rejection.

**Architecture:** A new `BookingsModule` with a `Booking` entity on the existing `booking` table, a thin `BookingsRepository`, a `BookingsService` that validates by hand and returns a result union, and a `BookingsController` that maps each error code to an `HttpException` with the shared error body. The interval rule stays in `api/src/bookings/booking-rules.ts`.

**Tech Stack:** Nest.js 12, TypeORM 1, Postgres 16, Vitest 4, oxlint, OpenAPI 3.1 (Redocly lint), runbooks plugin.

**Spec:** `docs/superpowers/specs/2026-11-04-sch-6-create-booking-design.md`

## Global Constraints

- Check order: `invalid_data` (422) → `unknown_resource` (404) → `id_taken` (409) → `conflict` (409) → insert (201). A rejection writes no row.
- Valid id: a JSON string matching `^[A-Za-z0-9_-]{1,64}$`. Case-sensitive. A number is `invalid_data`.
- Valid resource: a non-empty string. Not trimmed, not case-folded; anything not in the table is `unknown_resource`.
- Times: `parseInterval(start, end)` from `booking-rules.ts` only. Response times are numbers.
- API field names: `{ id, resource, start, end, status }`. Columns: `id`, `resource_id`, `start_time`, `end_time`, `status`.
- Error body: `{ error, message, conflicts? }`; `conflicts` (ids only) appears only on `conflict`.
- Conflict order: `ORDER BY id COLLATE "C"`, in the repository only. The service never re-sorts.
- Malformed JSON, top-level `null` or string body: Nest's default 400, unchanged.
- No new dependencies, no migration, no global pipes or filters.
- Commits: conventional, ending with `(SCH-6)`.
- `api/openapi.yaml` changes in the same commit as the controller.

## Review Focus

1. `start: 0` is a valid time; a truthiness check (`if (!start)`) would reject it. → Service test "accepts start 0" (Task 1).
2. A body carrying `status: "canceled"` (or any extra field) still creates an `active` booking. → Service test "ignores extra fields and always inserts active" (Task 1).
3. A numeric id (`7`) is `invalid_data`, not silently coerced to `"7"`. → Service test row in "rejects invalid data" (Task 1).
4. `" R1"` and `"r1"` reach `exists()` unchanged and come back `unknown_resource`. → Service test "passes resource unchanged" (Task 1).
5. Ids `A` and `a` are different bookings: creating `a` after `A` on another interval is 201, not `id_taken`. → Runbook step S10 (Task 3).

Known gap, accepted: "canceled bookings never conflict" and "a canceled id is `id_taken`" are proven only with mocks here, since no endpoint can cancel yet. The SCH-8 cancel runbook must add both against real Postgres (noted on SCH-8 in Task 4).

---

### Task 0: Commit the design inputs

**Files:**
- Commit: `GLOSSARY.md`, `docs/superpowers/specs/2026-11-04-sch-6-create-booking-design.md`, this plan, `.issues/issues/SCH-5/*`, `.issues/issues/SCH-6/*`

- [ ] **Step 1: Commit the tracker sync**

```bash
git add .issues/issues/SCH-5 .issues/issues/SCH-6
git commit -m "chore: sync SCH-5 to done and start SCH-6 (SCH-6)"
```

- [ ] **Step 2: Commit the spec, glossary and plan**

```bash
git add GLOSSARY.md docs/superpowers/specs/2026-11-04-sch-6-create-booking-design.md docs/superpowers/plans/2026-11-04-sch-6-create-booking.md
git commit -m "docs: add SCH-6 design, plan and glossary terms (SCH-6)"
```

---

### Task 1: Booking entity, repository and service

**Files:**
- Create: `api/src/bookings/booking.entity.ts`
- Create: `api/src/bookings/bookings.repository.ts`
- Create: `api/src/bookings/bookings.service.ts`
- Test: `api/src/bookings/bookings.service.spec.ts`

**Interfaces:**
- Consumes: `parseInterval(start: unknown, end: unknown): Interval | null` and `overlaps(a: Interval, b: Interval): boolean` from `./booking-rules.js`; `ResourcesService.exists(id: string): Promise<boolean>` from `../resources/resources.service.js`.
- Produces:
  - `booking.entity.ts`: `type BookingStatus = 'active' | 'canceled'`; `@Entity('booking') class Booking { id: string; resource: string; start: number; end: number; status: BookingStatus }`. Properties use the API names; `@Column({ name: 'resource_id' | 'start_time' | 'end_time' })` maps them, so the entity serializes as the response body.
  - `bookings.repository.ts`: `@Injectable() class BookingsRepository` with `findById(id: string): Promise<Booking | null>`, `findActiveByResource(resource: string): Promise<Booking[]>` (where `status = 'active'`, `ORDER BY id COLLATE "C"` via the query builder) and `insert(booking: Booking): Promise<void>`. Use TypeORM `insert`, never `save` (save would update an existing row).
  - `bookings.service.ts`:
    ```ts
    export type CreateError = 'invalid_data' | 'unknown_resource' | 'id_taken' | 'conflict';
    export type CreateResult =
      | { ok: true; booking: Booking }
      | { ok: false; error: Exclude<CreateError, 'conflict'> }
      | { ok: false; error: 'conflict'; conflicts: string[] };
    @Injectable() class BookingsService { create(body: unknown): Promise<CreateResult> }
    ```

- [ ] **Step 1: Write the failing service tests**

Follow `api/src/resources/resources.service.spec.ts`: `Test.createTestingModule` with `BookingsService`, `{ provide: BookingsRepository, useValue: { findById, findActiveByResource, insert } }` and `{ provide: ResourcesService, useValue: { exists } }`, all `vi.fn()` reset in `beforeEach`. Default mocks: `exists → true`, `findById → null`, `findActiveByResource → []`. `const valid = { id: 'A', resource: 'R1', start: 10, end: 20 }`.

Tests (names and assertions):
- `creates an active booking` → `create(valid)` resolves `{ ok: true, booking: { id: 'A', resource: 'R1', start: 10, end: 20, status: 'active' } }`; `insert` called once with that booking.
- `converts digit-only times to numbers` → `{ ...valid, start: '10', end: '20' }` gives `booking.start === 10`, `booking.end === 20`.
- `accepts start 0` → `{ ...valid, start: 0 }` is `ok: true`.
- `ignores extra fields and always inserts active` → `{ ...valid, status: 'canceled', foo: 1 }` inserts `{ id: 'A', resource: 'R1', start: 10, end: 20, status: 'active' }` (`toStrictEqual`).
- `rejects invalid data` (`it.each`), each `{ ok: false, error: 'invalid_data' }`, `exists`, `findById` and `insert` never called: `undefined`, `null`, `[]`, `'A'`, `{ ...valid, id: undefined }`, `{ ...valid, id: 7 }`, `{ ...valid, id: '' }`, `{ ...valid, id: 'a b' }`, `{ ...valid, id: 'a/b' }`, `{ ...valid, id: 'x'.repeat(65) }`, `{ ...valid, resource: undefined }`, `{ ...valid, resource: 7 }`, `{ ...valid, resource: '' }`, `{ ...valid, start: undefined }`, `{ ...valid, start: -1 }`, `{ ...valid, end: 2147483648 }`, `{ ...valid, start: 20, end: 20 }`, `{ ...valid, start: 10.5 }`.
- `accepts a 64-character id` → `{ ...valid, id: 'x'.repeat(64) }` is `ok: true`.
- `rejects an unknown resource` → `exists → false` gives `{ ok: false, error: 'unknown_resource' }`; `findById` and `insert` not called.
- `passes resource unchanged` → `{ ...valid, resource: ' R1' }` with `exists → false`: `exists` called with `' R1'`, result `unknown_resource`.
- `rejects a taken id, active or canceled` (`it.each` over `'active'`, `'canceled'`) → `findById` resolves a booking with that status: `{ ok: false, error: 'id_taken' }`; `findActiveByResource` and `insert` not called.
- `rejects an overlap with the conflicting ids in repository order` → `findActiveByResource` resolves `[{ id: 'B', start: 20, end: 30 }, { id: 'A', start: 10, end: 20 }, { id: 'Z', start: 40, end: 50 }]` (as `Booking`s on R1), create `[19,21)`: `{ ok: false, error: 'conflict', conflicts: ['B', 'A'] }`; `insert` not called.
- `accepts [20,30) after [10,20)` → active `[10,20)` on R1, create `{ ...valid, id: 'B', start: 20, end: 30 }` is `ok: true`.
- `asks the repository only for active bookings of the requested resource` → `findActiveByResource` called with `'R1'` (the status and resource filters are the repository's job; the canceled and other-resource cases are proven against Postgres in SCH-8's runbook).
- `checks in order` → with all of `exists → false`, `findById → booking`, overlapping active booking: invalid body gives `invalid_data`; valid body gives `unknown_resource`; with `exists → true`, `id_taken`; with `findById → null`, `conflict`.

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -w api -- bookings.service`
Expected: FAIL, cannot resolve `./bookings.service.js`.

- [ ] **Step 3: Create `booking.entity.ts` and `bookings.repository.ts`** with the shapes in Interfaces.

- [ ] **Step 4: Implement `BookingsService.create(body: unknown): Promise<CreateResult>`**

Validate the shape in one place first (a module-level `const ID = /^[A-Za-z0-9_-]{1,64}$/`, body is a non-null non-array object, `typeof id === 'string'`, `typeof resource === 'string' && resource !== ''`, `parseInterval(start, end) !== null`), then run the async checks in the Global Constraints order. Conflicts are `active.filter(b => overlaps(interval, b)).map(b => b.id)`, keeping the repository order.

- [ ] **Step 5: Run the tests**

Run: `npm test -w api -- bookings.service`
Expected: PASS.

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add api/src/bookings
git commit -m "feat: add booking entity, repository and create service (SCH-6)"
```

---

### Task 2: Controller, module wiring and OpenAPI

**Files:**
- Create: `api/src/bookings/bookings.controller.ts`
- Create: `api/src/bookings/bookings.module.ts`
- Modify: `api/src/app.module.ts` (add `BookingsModule` to `imports`)
- Modify: `api/openapi.yaml`
- Test: `api/src/bookings/bookings.controller.spec.ts`

**Interfaces:**
- Consumes: `BookingsService.create`, `CreateResult`, `CreateError`, `Booking` from Task 1.
- Produces: `@Controller('bookings') class BookingsController { @Post() create(@Body() body: unknown): Promise<Booking> }`. On `ok: false` it throws `new HttpException(errorBody, STATUS[error])` with `STATUS: Record<CreateError, number> = { invalid_data: 422, unknown_resource: 404, id_taken: 409, conflict: 409 }` and `errorBody = { error, message, conflicts? }`. Message wording is the builder's call. `@Post()` already answers 201.
- `BookingsModule`: `imports: [TypeOrmModule.forFeature([Booking]), ResourcesModule]`, `controllers: [BookingsController]`, `providers: [BookingsService, BookingsRepository]`.

- [ ] **Step 1: Write the failing controller tests**

Follow `resources.controller.spec.ts`, with `{ provide: BookingsService, useValue: { create } }`.
- `returns the created booking` → `create` resolves `{ ok: true, booking }`; `controller.create(body)` resolves `booking`; `create` called with `body` unchanged.
- `maps each rejection to its status and error body` (`it.each`): `invalid_data → 422`, `unknown_resource → 404`, `id_taken → 409`. Assert the thrown `HttpException` has `getStatus()` equal to the status and `getResponse()` matching `{ error: <code>, message: expect.any(String) }` with no `conflicts` key.
- `returns conflicts on a conflict` → `{ ok: false, error: 'conflict', conflicts: ['A', 'B'] }` throws status 409 with `getResponse()` matching `{ error: 'conflict', message: expect.any(String), conflicts: ['A', 'B'] }`.

- [ ] **Step 2: Run them to see them fail**

Run: `npm test -w api -- bookings.controller`
Expected: FAIL, cannot resolve `./bookings.controller.js`.

- [ ] **Step 3: Implement the controller and `BookingsModule`, and add `BookingsModule` to `AppModule`.**

- [ ] **Step 4: Run the whole suite** (boots `AppModule` in the runbook specs, so it proves the wiring)

Run: `docker compose up -d db && npm test`
Expected: PASS, including the existing health and resources runbook specs.

- [ ] **Step 5: Update `api/openapi.yaml`**

Add `POST /bookings` (`operationId: createBooking`) with:
- request body schema `CreateBookingRequest`: `required: [id, resource, start, end]`; `id` string, pattern `^[A-Za-z0-9_-]{1,64}$`; `resource` string, `minLength: 1`; `start` and `end` as `oneOf` integer `0..2147483647` or string pattern `^\d+$`; description says `start < end`.
- `201`: `Booking` schema (`id`, `resource`, `start` integer, `end` integer, `status` enum `active | canceled`).
- `422`, `404`, `409`: `BookingError` schema (`required: [error, message]`, `error` enum of the four codes, `conflicts` string array described as "only on `conflict`, in ascending id order by character code"). Give `409` two examples, `id_taken` and `conflict` with `conflicts: [A, B]`.
- `400`: `NestError`, described as "malformed JSON, or a top-level `null` or string body".

Run: `npx @redocly/cli lint api/openapi.yaml`
Expected: no errors.

- [ ] **Step 6: Lint, typecheck and build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add api/src/bookings api/src/app.module.ts api/openapi.yaml
git commit -m "feat: add POST /bookings endpoint (SCH-6)"
```

---

### Task 3: Runbook `bookings.create-booking`

**Files:**
- Create (via `/runbooks:create`): `docs/runbooks/bookings/create-booking.md`
- Create (via `/runbooks:to-test`): `api/test/runbooks/bookings-create-booking.spec.ts`

**Interfaces:**
- Consumes: `POST /bookings` from Task 2. Script setup per CLAUDE.md "API scripts": boot `AppModule`, `app.listen(0)`, `fetch`, `beforeEach` runs `DELETE FROM booking` through `app.get(DataSource)`, and seeds bookings only through `POST /bookings`.

- [ ] **Step 1: Write the runbook** with `/runbooks:create bookings.create-booking` (api surface), from the spec and the diff. It must contain at least these steps, in this order:

| Step | Given | Request | Expected |
|---|---|---|---|
| S01 | empty | `A` R1 `[10,20)` | 201 `{ id: 'A', resource: 'R1', start: 10, end: 20, status: 'active' }` |
| S02 | empty | `A` R1 `start: '10', end: '20'` | 201 with `start: 10`, `end: 20` numbers |
| S03 | empty | each invalid body (missing `end`, `start: -1`, `end: 2147483648`, `[20,20)`, `id: 'a b'`, 65-char id, `resource: 7`, `[]`) | 422 `invalid_data` each; then `A` R1 `[10,20)` is 201 (nothing was written) |
| S04 | empty | malformed JSON `{` and body `null` | 400 (Nest default) |
| S05 | empty | `R9`, then `r1` | 404 `unknown_resource` each |
| S06 | `A` R1 `[10,20)` | `A` R2 `[50,60)` | 409 `id_taken` |
| S07 | `A` R1 `[10,20)` | `B` R1 `[20,30)` | 201 (half-open boundary) |
| S08 | `A`, `B` as S07 | `C` R1 `[19,21)` | 409 `conflict`, `conflicts: ['A', 'B']` |
| S09 | after S08 | `C` R2 `[19,21)` | 201 (rejected id stays free; other resource never conflicts) |
| S10 | `A` R1 `[10,20)` | `a` R1 `[30,40)` | 201 (ids are case-sensitive) |
| S11 | `B`, `a`, `10`, `9` on R3 at `[0,1)`, `[1,2)`, `[2,3)`, `[3,4)` | `X` R3 `[0,4)` | 409 `conflict`, `conflicts: ['10', '9', 'B', 'a']` |
| S12 | `A` R1 `[10,20)` | `A` R9 `[10,20)`, then `A` R1 `[10,20)` | 404 `unknown_resource` (resource before id), then 409 `id_taken` (id before conflict) |

Each step asserts status first, then `error` and `conflicts`; effects are read back through a follow-up `POST` (no `GET /bookings` yet).

- [ ] **Step 2: Write its script** with `/runbooks:to-test bookings.create-booking`. One `it('S0n ...')` per step.

- [ ] **Step 3: Run it**

Run: `/runbooks:run bookings.create-booking`
Expected: every step passes; the runbook becomes `active`. A failing S11 means the `COLLATE "C"` order did not reach the SQL (fix `findActiveByResource`, not the runbook).

- [ ] **Step 4: Run the affected runbooks**

Run: `/runbooks:list --affected`, then `/runbooks:run --affected`
Expected: all pass.

- [ ] **Step 5: Commit** (if the runbook commands did not already)

```bash
git add docs/runbooks/bookings/create-booking.md api/test/runbooks/bookings-create-booking.spec.ts
git commit -m "test: add bookings.create-booking runbook and script (SCH-6)"
```

---

### Task 4: Hand-off notes

Each comment is a pmkit write: run it with `--dry-run --json` first, show it, and ask before the real run.

- [ ] **Step 1: Note the split on SCH-9** with `pmkit issues comment SCH-9 --body-file <tmp>`: "SCH-6's runbook `bookings.create-booking` covers every create rejection and the id order over HTTP. SCH-9 only replays the PRD example."
- [ ] **Step 2: Note the gap on SCH-8** with `pmkit issues comment SCH-8 --body-file <tmp>`: "The cancel runbook must prove against Postgres that a canceled booking never conflicts and that its id still returns `id_taken` on `POST /bookings` (SCH-6 proved both with mocks only)."
- [ ] **Step 3: Final checks**

Run: `npm test && npm run lint && npm run typecheck && npm run build && npx @redocly/cli lint api/openapi.yaml`
Expected: all pass.
