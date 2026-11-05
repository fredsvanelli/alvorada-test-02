# SCH-6: Create a booking with `POST /bookings`

Sharpened spec from the grill session on SCH-6. Inputs: `.issues/docs/PRD.md`, `docs/diagrams/architecture.md` (section 4.1), `GLOSSARY.md` and the SCH-6 acceptance criteria.

## Request

`POST /bookings` with a JSON body `{ id, resource, start, end }`. Extra fields are ignored.

## Checks, in order

The first failing check wins. A rejection writes no row, so its id stays free.

| # | Code | Status | When |
|---|---|---|---|
| 1 | `invalid_data` | 422 | The body that reaches the service is not an object (an array, or no body at all); `id` is not a string matching `^[A-Za-z0-9_-]{1,64}$`; `resource` is missing, not a string, or empty; or `parseInterval(start, end)` returns `null` (missing, not an integer in `0..2147483647`, or `start >= end`; digit-only strings are accepted) |
| 2 | `unknown_resource` | 404 | `ResourcesService.exists(resource)` is false. Exact match: `r1` is unknown |
| 3 | `id_taken` | 409 | A booking with this id exists, active or canceled. Ids are case-sensitive: `a` and `A` differ |
| 4 | `conflict` | 409 | `overlaps()` is true for at least one active booking of the same resource. Canceled bookings and other resources never conflict |
| - | created | 201 | Inserted with status `active` |

## Responses

- 201 body: `{ id, resource, start, end, status: "active" }`. Times are numbers, even when sent as digit-only strings (`"10"` becomes `10`). The API uses these names; the entity maps them to `resource_id`, `start_time` and `end_time`.
- Error body, shared by every bookings endpoint (SCH-7 and SCH-8 reuse it): `{ error: <code>, message: <text for people>, conflicts?: string[] }`. `conflicts` appears only on `conflict` and holds ids, not bookings.
- Conflict ids are in **ascending id order**: compared by character code (`ORDER BY id COLLATE "C"`), so `10` comes before `9` and `B` before `a`. Postgres's default `en_US.utf8` collation would mix cases (`a, A, b, B`), so the query states the collation.
- Malformed JSON keeps Nest's default 400 from the body parser. So does a top-level `null` or string: body-parser's `strict` mode (Nest's default) rejects any top-level JSON that is not an object or array before the controller runs. Known limit, documented in OpenAPI. *(Builder's call: keep Nest's parser as is. Turning `strict` off would need a bootstrap change shared by `main.ts` and the runbook scripts, for the same edge case the grill already chose not to cover.)*

## Backend shape

- `Booking` entity on the existing `booking` table (`id`, `resource_id`, `start_time`, `end_time`, `status` default `'active'`), registered with `TypeOrmModule.forFeature` in `BookingsModule`. No migration: SCH-4 already created the table.
- `BookingsRepository`, a thin class over TypeORM: `findById(id)`, `findActiveByResource(resource)` (ordered by `id COLLATE "C"`) and `insert(booking)`.
- `BookingsService.create(body: unknown)` validates by hand (no `class-validator`) and returns a result union:
  `{ ok: true, booking } | { ok: false, error: 'invalid_data' | 'unknown_resource' | 'id_taken' } | { ok: false, error: 'conflict', conflicts: string[] }`.
  The interval rule stays in `booking-rules.ts` (`parseInterval`, `overlaps`).
- `BookingsController` only maps the result: each error code to its status and the error body, success to 201.
- `BookingsModule` imports `ResourcesModule` for `exists(id)` and is added to `AppModule`.

## Tests and docs

- Unit tests: `BookingsService` (repository and `ResourcesService` mocked) covering every check, the check order, the `[10,20)` then `[20,30)` boundary, canceled and other-resource non-conflicts, and that `conflicts` keeps the order the repository returns. `BookingsController` covering the code-to-status map.
- Runbook `bookings.create-booking` (api surface) via `/runbooks:create`, with its script at `api/test/runbooks/bookings-create-booking.spec.ts`: one test per step, over HTTP against `bookings_test`. One step proves the collation against real Postgres: active bookings `B`, `a`, `10` and `9` on one resource, then an overlapping create returns `conflicts` `["10", "9", "B", "a"]`. *(Builder's call: the order lives only in the repository's SQL, the one place, like `[start, end)` in `booking-rules.ts`. The service does not re-sort, and a mocked unit test cannot catch a collation bug, so the proof is the runbook step.)* SCH-9 keeps only the replay of the PRD example; add a note on SCH-9 saying so.
- `api/openapi.yaml`: `POST /bookings`, a `Booking` schema and a `BookingError` schema. Validate with `npx @redocly/cli lint api/openapi.yaml`.
- `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` pass.

## Out of scope

- Availability, cancel and list (SCH-7, SCH-8), the PRD replay e2e (SCH-9) and the web form (SCH-10).
- Concurrency: the check-then-insert is not atomic. Two simultaneous creates with the same id hit the primary key (Postgres `23505`) and return 500. Listed for the README's "what is left" (SCH-11).
- Mapping malformed JSON to 422 (it needs a global exception filter).

## Decisions worth the README (SCH-11)

- Ascending id order is defined by character code, not by the database's locale collation.
- The service returns a result union instead of throwing HTTP exceptions, so HTTP stays in the controller.
