---
id: SCH-6
title: "Create a booking with POST /bookings (invalid_data, unknown_resource, id_taken, conflict)"
type: feature
status: done
estimate: 5
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-4, SCH-5]
branch: sch-6-create-a-booking-with-post-bookings
created: 2026-11-04T20:00:44.439Z
updated: 2026-11-05T02:11:10Z
---

## Acceptance criteria

- [ ] `POST /bookings` with a valid `id`, `resource`, `start` and `end` returns 201 and the booking with status `active`
- [ ] A missing field, a time that is not an integer from 0 to 2147483647, or `start >= end` returns 422 `invalid_data` (from `parseInterval`)
- [ ] An unknown resource returns 404 `unknown_resource`
- [ ] An id already used, by an active or a canceled booking, returns 409 `id_taken`
- [ ] An overlap with an active booking of the same resource returns 409 `conflict` with the conflicting ids in ascending order; canceled bookings and other resources never conflict
- [ ] `[20,30)` is accepted after `[10,20)` on the same resource
- [ ] The checks run in the order invalid_data, unknown_resource, id_taken, conflict, and a rejection writes no row, so its id can be used again
- [ ] Unit tests cover the service and the controller, and test, lint, typecheck and build pass

## Description

### Context

Fourth step of SCH-2, blocked by SCH-4 (the `booking` table and `ResourcesService.exists`) and SCH-5 (`parseInterval` and `overlaps`). It builds the create flow from section 4.1 of `docs/diagrams/architecture.md`. SCH-4 left the `Booking` entity to this issue.

SCH-7 and SCH-8 add to the same `BookingsModule`. Whichever of the three starts first creates the module, the entity and `BookingsRepository`; the others extend them.

### Scope (in)

- `Booking` entity on the existing `booking` table (`id`, `resource_id`, `start_time`, `end_time`, `status`), registered with TypeORM
- `BookingsModule` with `BookingsController`, `BookingsService` and `BookingsRepository` (find by id, active bookings of a resource ordered by id, insert), importing `ResourcesModule` for `exists(id)`
- `POST /bookings` taking `{ id, resource, start, end }`, with the checks in this order: `invalid_data` (422), `unknown_resource` (404), `id_taken` (409), `conflict` (409, with the conflicting ids in ascending order), then insert with status `active` (201)
- The controller only maps the service result to a status code and body
- Unit tests for the service (repository and resources mocked) and the controller

### Out of scope

- Availability, cancel and list (SCH-7 and SCH-8)
- Concurrent requests, excluded by the PRD: the check-then-insert is not atomic, and there is no exclusion constraint or lock
- An e2e test over HTTP against Postgres (SCH-9)
- The web form (SCH-10)

### Open questions for the design step

- How is the body validated: by hand with `parseInterval` (it takes the raw values and converts digit-only strings), or with `class-validator` and `ValidationPipe` (not installed)? Either way it must return 422 `invalid_data`, not Nest's default 400
- The error body shared by every endpoint (for example `{ error, conflicts? }`), and whether the service returns a result union or throws Nest exceptions
- What makes an `id` invalid: empty, too long, which characters
- Is a `resource` of the wrong type (a number, an empty string) `invalid_data` or `unknown_resource`?
