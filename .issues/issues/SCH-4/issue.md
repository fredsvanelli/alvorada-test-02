---
id: SCH-4
title: "Add the database schema, seed R1 to R5, and expose GET /resources"
type: task
status: in_review
estimate: 3
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-3]
branch: sch-4-add-the-database-schema-seed-r1-to-r5
created: 2026-11-04T20:00:44.227Z
updated: 2026-11-04T23:14:50Z
---

## Description

### Context

Second step of SCH-2, after the SCH-3 scaffold. Create the two tables from the data model in `docs/diagrams/architecture.md`, seed the fixed resources R1 to R5, and add `ResourcesModule` with `GET /resources`. SCH-6, SCH-7 and SCH-8 build on the `booking` table and on `ResourcesService.exists(id)`.

SCH-3 left a TypeORM `DatabaseModule` with `migrationsRun: true`, `synchronize: false` and `autoLoadEntities: true`, and no migrations yet.

### Scope (in)

- One hand-written migration that creates `resource` (`id` text PK, `name` text) and `booking` (`id` text PK, `resource_id` text FK to `resource`, `start_time` integer, `end_time` integer, `status` text default `'active'`), every column `NOT NULL`, with `CHECK (start_time < end_time)` and `CHECK (status IN ('active', 'canceled'))`. The FK keeps the default `ON DELETE RESTRICT`
- The same migration seeds R1 Agora Room, R2 Pixel Room, R3 4K Projector, R4 Orbit Room and R5 Focus Room (names from the design prototype). TypeORM's migrations table makes it run once, so later starts do not duplicate them
- `Resource` entity registered with TypeORM
- `ResourcesModule`: `ResourcesService` with `list()` (`ORDER BY id ASC` in the query) and `exists(id)` (a database lookup on each call, no in-memory cache), and `ResourcesController` with `GET /resources` returning a plain JSON array `[{ id, name }]`
- Unit tests for the service and controller
- Update the seeded list (R1, R2) in `docs/diagrams/architecture.md` and `CLAUDE.md` to R1 to R5 (`GLOSSARY.md` is already updated)

### Out of scope

- `BookingsModule`, `BookingsRepository` and every booking endpoint (SCH-6 to SCH-8)
- The `Booking` entity: SCH-6 adds it, since nothing uses it before then. The `booking` table comes from this migration
- `booking-rules.ts` (SCH-5)
- An API e2e test over HTTP (SCH-9), and an automated test against Postgres: the database criteria are checked by hand with `psql`
- A `kind` column on `resource`: the UI shows the name only
- A TypeORM CLI script: migrations run on startup through `migrationsRun`. Add it when a second schema change shows up
- An index on `booking (resource_id, status)`: add it if a query ever needs it
- Creating, editing or deleting resources: the list is fixed

### Design decisions (from the grilling session)

- Seed R1 to R5 rather than the prototype's R1 to R10, so ascending text order of `id` stays correct
- Seed inside the migration, not in a separate startup step
- Time columns stay `integer` (int32). SCH-5's `validInterval` rejects values outside that range, so they return `invalid_data` and never a database error

## Acceptance criteria

- [ ] Starting the API against an empty database creates the `resource` and `booking` tables, and starting it again changes nothing (checked by hand with `psql`, steps in the PR)
- [ ] The database rejects a booking row with `start_time >= end_time`, with a `status` other than `active` or `canceled`, or with a `resource_id` that does not exist (checked by hand with `psql`, steps in the PR)
- [ ] R1, R2, R3, R4 and R5 exist after the first start, and later starts do not duplicate them (checked by hand with `psql`, steps in the PR)
- [ ] `GET /resources` returns 200 with R1 to R5 (id and name), in ascending id order
- [ ] `ResourcesService.exists(id)` returns true for R1 and false for an unknown id, ready for SCH-6 and SCH-7
- [ ] Unit tests cover the service and the controller, and test, lint, typecheck and build pass
