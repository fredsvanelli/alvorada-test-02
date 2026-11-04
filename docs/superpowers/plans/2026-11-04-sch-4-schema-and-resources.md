# SCH-4 Schema, Seed and GET /resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One migration that creates `resource` and `booking` and seeds R1 to R5, plus a `ResourcesModule` that serves `GET /resources` and exposes `ResourcesService.exists(id)` for SCH-6 and SCH-7.

**Architecture:** A hand-written TypeORM migration in `api/src/database/migrations/` holds the DDL and the seed. The existing `DatabaseModule` already loads that folder and runs it on startup (`migrationsRun: true`). `ResourcesModule` registers the `Resource` entity with `TypeOrmModule.forFeature` and wraps the repository in `ResourcesService`. `ResourcesController` only maps `GET /resources` to `list()`.

**Tech Stack:** Nest.js 12, `@nestjs/typeorm` 12, TypeORM 1.1.2, Postgres 16, Vitest 4 (globals on). ESM with `nodenext`, so relative imports end in `.js`.

**Spec:** `.issues/issues/SCH-4/issue.md` (no separate design doc, agreed in brainstorming). Domain background: `.issues/docs/PRD.md`, `docs/diagrams/architecture.md`, `GLOSSARY.md`.

## Global Constraints

- Tables: `resource` (`id` text PK, `name` text) and `booking` (`id` text PK, `resource_id` text FK to `resource`, `start_time` integer, `end_time` integer, `status` text default `'active'`). Every column `NOT NULL`. `CHECK (start_time < end_time)` and `CHECK (status IN ('active', 'canceled'))`. The FK keeps the default `ON DELETE RESTRICT`.
- Seed, in the same migration: R1 Agora Room, R2 Pixel Room, R3 4K Projector, R4 Orbit Room, R5 Focus Room.
- Time columns stay `integer` (int32).
- `list()` sorts with `ORDER BY id ASC` in the query, not in JS. `exists(id)` hits the database on every call, no cache.
- `GET /resources` returns a plain JSON array `[{ id, name }]`, no envelope.
- Not in this issue: a `Booking` entity, `BookingsModule`, `booking-rules.ts`, a TypeORM CLI script, an index on `booking`, a `kind` column, any write endpoint for resources, an HTTP e2e test, an automated test against Postgres.
- No new dependencies.
- Commits are conventional and end with `(SCH-4)`, plus the `Co-Authored-By` line.

## Review Focus

1. **API restarted on a database that already has the schema:** nothing is re-created and R1 to R5 are not inserted twice. (Task 1, Step 4.)
2. **A booking row inserted without `status`:** it gets `'active'`, the value SCH-6 relies on. (Task 1, Step 5.)
3. **Deleting a resource that has a booking:** Postgres refuses (`ON DELETE RESTRICT`), so no booking ever points at a missing resource. (Task 1, Step 5.)
4. **An id that differs only by case (`r1`):** `exists` passes the id through unchanged, so `r1` is unknown, and SCH-6 returns `unknown_resource` for it. (Task 2, service test.)
5. **`list()` sorting:** the order comes from the query (`order: { id: 'ASC' }`), not from the order rows happen to come back in. (Task 2, service test.)

---

### Task 0: Commit the design artifacts

- [ ] **Step 1: Check the working tree holds only pmkit and glossary changes**

Run: `git status --short`
Expected: changes only under `.issues/`, in `GLOSSARY.md` and in this plan file.

- [ ] **Step 2: Commit**

```bash
git add .issues GLOSSARY.md docs/superpowers/plans/2026-11-04-sch-4-schema-and-resources.md
git commit -m "docs: add the SCH-4 plan and grilling outcomes (SCH-4)"
```

---

### Task 1: Migration with schema and seed

**Files:**
- Create: `api/src/database/migrations/1793750400000-InitSchema.ts`
- Modify: `CLAUDE.md:35` (`seeded R1 and R2` → `seeded R1 to R5`)
- Modify: `docs/diagrams/architecture.md:43` (`fixed list, seeded: R1, R2` → `fixed list, seeded: R1 to R5`)

**Interfaces:**
- Produces: tables `resource` and `booking` exactly as in Global Constraints. SCH-6 maps its `Booking` entity onto `booking`, and Task 2 maps `Resource` onto `resource`.

There is no unit test here. The issue checks the database criteria by hand with `psql`, and Steps 3 to 5 are those checks. Keep their commands, because they go into the PR description.

- [ ] **Step 1: Write the migration**

Class `InitSchema1793750400000 implements MigrationInterface` (from `typeorm`). `up(queryRunner)` runs this SQL through `queryRunner.query`. `down(queryRunner)` runs `DROP TABLE booking` and then `DROP TABLE resource`.

```sql
CREATE TABLE resource (
  id   text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE booking (
  id          text    PRIMARY KEY,
  resource_id text    NOT NULL REFERENCES resource (id),
  start_time  integer NOT NULL,
  end_time    integer NOT NULL,
  status      text    NOT NULL DEFAULT 'active',
  CONSTRAINT booking_interval_check CHECK (start_time < end_time),
  CONSTRAINT booking_status_check CHECK (status IN ('active', 'canceled'))
);

INSERT INTO resource (id, name) VALUES
  ('R1', 'Agora Room'),
  ('R2', 'Pixel Room'),
  ('R3', '4K Projector'),
  ('R4', 'Orbit Room'),
  ('R5', 'Focus Room');
```

- [ ] **Step 2: Update the seeded list in the docs**

Make the two one-line edits listed under **Files**.

- [ ] **Step 3: Start on an empty database and check the tables and seed**

This wipes the local dev volume. It is dev data only, so that's fine, but it really does delete it.

```bash
docker compose down -v && docker compose up -d --wait db
npm run dev:api   # stop with Ctrl+C once "Nest application successfully started" shows
docker compose exec db psql -U bookings -d bookings -c '\d resource' -c '\d booking' -c 'SELECT * FROM resource ORDER BY id' -c 'SELECT name FROM migrations'
```

Expected: both tables with the columns, `NOT NULL`s, default, FK and two checks above. Five resource rows R1 to R5 with their names. One row `InitSchema1793750400000` in `migrations`.

- [ ] **Step 4: Start again and check nothing changed**

Run `npm run dev:api` again, stop it, then:

```bash
docker compose exec db psql -U bookings -d bookings -c 'SELECT count(*) FROM resource' -c 'SELECT count(*) FROM migrations'
```

Expected: `5` and `1`.

- [ ] **Step 5: Check the constraints**

```bash
docker compose exec db psql -U bookings -d bookings \
  -c "INSERT INTO booking (id, resource_id, start_time, end_time) VALUES ('X1', 'R1', 20, 20)" \
  -c "INSERT INTO booking (id, resource_id, start_time, end_time, status) VALUES ('X2', 'R1', 10, 20, 'deleted')" \
  -c "INSERT INTO booking (id, resource_id, start_time, end_time) VALUES ('X3', 'R9', 10, 20)"
```

Expected, in order: `violates check constraint "booking_interval_check"`, `violates check constraint "booking_status_check"` and `violates foreign key constraint`.

Then check the default and the restrict:

```bash
docker compose exec db psql -U bookings -d bookings \
  -c "INSERT INTO booking (id, resource_id, start_time, end_time) VALUES ('X4', 'R1', 10, 20)" \
  -c "SELECT status FROM booking WHERE id = 'X4'"
docker compose exec db psql -U bookings -d bookings -c "DELETE FROM resource WHERE id = 'R1'"
docker compose exec db psql -U bookings -d bookings -c "DELETE FROM booking WHERE id = 'X4'"
```

Expected: `active`, then `violates foreign key constraint` on the delete, then `DELETE 1` (the cleanup).

- [ ] **Step 6: Commit**

```bash
git add api/src/database/migrations CLAUDE.md docs/diagrams/architecture.md
git commit -m "feat: add the resource and booking schema and seed R1 to R5 (SCH-4)"
```

---

### Task 2: ResourcesModule and GET /resources

**Files:**
- Create: `api/src/resources/resource.entity.ts`
- Create: `api/src/resources/resources.service.ts`
- Create: `api/src/resources/resources.controller.ts`
- Create: `api/src/resources/resources.module.ts`
- Modify: `api/src/app.module.ts` (add `ResourcesModule` to `imports`)
- Test: `api/src/resources/resources.service.spec.ts`
- Test: `api/src/resources/resources.controller.spec.ts`

**Interfaces:**
- Consumes: the `resource` table from Task 1.
- Produces:
  - `class Resource { id: string; name: string }`, `@Entity('resource')`, `@PrimaryColumn('text') id`, `@Column('text') name`.
  - `ResourcesService.list(): Promise<Resource[]>`
  - `ResourcesService.exists(id: string): Promise<boolean>`
  - `ResourcesModule` exports `ResourcesService`, so SCH-6 and SCH-7 import the module and inject the service.

- [ ] **Step 1: Write the failing service test**

Build the testing module with `ResourcesService` and `{ provide: getRepositoryToken(Resource), useValue: { find, exists } }`, where `find` and `exists` are `vi.fn()` reset in `beforeEach`, in the same style as `api/src/health/health.controller.spec.ts`.

```ts
const rows = [
  { id: 'R1', name: 'Agora Room' },
  { id: 'R2', name: 'Pixel Room' },
];

it('lists resources sorted by id in the query', async () => {
  find.mockResolvedValue(rows);
  await expect(service.list()).resolves.toEqual(rows);
  expect(find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
});

it('returns true for a seeded id', async () => {
  exists.mockResolvedValue(true);
  await expect(service.exists('R1')).resolves.toBe(true);
  expect(exists).toHaveBeenCalledWith({ where: { id: 'R1' } });
});

it('returns false for an unknown id', async () => {
  exists.mockResolvedValue(false);
  await expect(service.exists('R9')).resolves.toBe(false);
});

it('passes the id through unchanged, so case matters', async () => {
  exists.mockResolvedValue(false);
  await service.exists('r1');
  expect(exists).toHaveBeenCalledWith({ where: { id: 'r1' } });
});

it('asks the database on every call', async () => {
  exists.mockResolvedValue(true);
  await service.exists('R1');
  await service.exists('R1');
  expect(exists).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npm test -w api -- resources.service`
Expected: FAIL, cannot resolve `./resources.service.js` / `./resource.entity.js`.

- [ ] **Step 3: Write `Resource` and `ResourcesService`**

Entity as in **Interfaces**. The service injects `@InjectRepository(Resource) Repository<Resource>`. `list()` returns `find({ order: { id: 'ASC' } })`. `exists(id)` returns `repository.exists({ where: { id } })`; that method exists in TypeORM 1.1.2.

- [ ] **Step 4: Run it and see it pass**

Run: `npm test -w api -- resources.service`
Expected: 5 passing.

- [ ] **Step 5: Write the failing controller test**

Build the testing module with `ResourcesController` and `{ provide: ResourcesService, useValue: { list } }`.

```ts
it('returns the service list as a plain array', async () => {
  const rows = [
    { id: 'R1', name: 'Agora Room' },
    { id: 'R2', name: 'Pixel Room' },
  ];
  list.mockResolvedValue(rows);
  await expect(controller.list()).resolves.toEqual(rows);
});
```

- [ ] **Step 6: Run it and see it fail**

Run: `npm test -w api -- resources.controller`
Expected: FAIL, cannot resolve `./resources.controller.js`.

- [ ] **Step 7: Write `ResourcesController`, `ResourcesModule` and wire it in**

`@Controller('resources')` with `@Get() list(): Promise<Resource[]>` calling `ResourcesService.list()`. `ResourcesModule`: `imports: [TypeOrmModule.forFeature([Resource])]`, `controllers: [ResourcesController]`, `providers: [ResourcesService]`, `exports: [ResourcesService]`. Add `ResourcesModule` to `AppModule.imports`.

- [ ] **Step 8: Run all checks**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: all pass, 6 new tests among them.

- [ ] **Step 9: Check the endpoint against the real database**

With the database from Task 1 running, start `npm run dev:api`, then:

```bash
curl -s -i localhost:3001/resources
```

Expected: `HTTP/1.1 200`, body
`[{"id":"R1","name":"Agora Room"},{"id":"R2","name":"Pixel Room"},{"id":"R3","name":"4K Projector"},{"id":"R4","name":"Orbit Room"},{"id":"R5","name":"Focus Room"}]`.
Stop the API.

- [ ] **Step 10: Commit**

```bash
git add api/src/resources api/src/app.module.ts
git commit -m "feat: add ResourcesModule with GET /resources (SCH-4)"
```

---

After Task 2, follow the CLAUDE.md overrides: run `/utils:review-work --base main --spec .issues/issues/SCH-4/issue.md`, deal with its findings, and put the `psql` and `curl` steps from Task 1 Steps 3 to 5 and Task 2 Step 9 in the PR description.
