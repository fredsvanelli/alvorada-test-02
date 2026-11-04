# SCH-3 Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postgres 16 in compose, a Nest.js API that proves it reaches Postgres through `GET /health`, and a Next.js app rendering a shadcn `Button`, all run from root npm workspace scripts.

**Architecture:** An npm workspace root holds `api/` (Nest CLI app: `@nestjs/config`, TypeORM inside `DatabaseModule`, a `HealthController`) and `web/` (`create-next-app` plus shadcn). Postgres alone runs in Docker and reads its credentials from `api/.env`, the same file the API reads.

**Tech Stack:** Node 22, npm workspaces, Nest.js, `@nestjs/config`, `@nestjs/typeorm` + `typeorm` + `pg`, Jest, Next.js (App Router), Tailwind, shadcn/ui, Postgres 16, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-04-sch-3-scaffold-design.md`

## Global Constraints

- npm only, with one root `package-lock.json`. No `api/package-lock.json` or `web/package-lock.json`, and no nested `.git`.
- `"engines": { "node": ">=22" }` in the root `package.json`.
- Ports: Postgres `5432:5432` (hardcoded), API `API_PORT=3001`, web 3000.
- Required API variables: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `API_PORT`.
- `api/.env.example` holds dev defaults only: `localhost`, `5432`, `bookings`/`bookings`/`bookings`, `3001`. `api/.env` is never committed.
- No extra dependencies: no Joi, `@nestjs/terminus`, `concurrently`, Turborepo, or dotenv.
- No placeholder code for later issues: no migrations, no entities, no `ResourcesModule` or `BookingsModule`, nothing in the web app that calls the API.
- `lint` scripts check only (no `--fix`).
- Commits are conventional and end with `(SCH-3)`, plus the `Co-Authored-By` line.

## Review Focus

1. **`api/.env` missing on a fresh clone:** `docker compose up -d db` fails with an error naming `api/.env`. (Task 1, Step 4.)
2. **One variable missing from `api/.env`:** the API refuses to boot and the error names that variable. (Task 2, Step 7.)
3. **Postgres down when the API starts:** the API exits after 3 retries instead of hanging. (Task 2, Step 8.)
4. **Postgres stops after the API booted:** `GET /health` returns 503, not 500 or a hang. (Task 2, unit test plus Step 8.)
5. **Fresh clone install:** a root `npm install` installs both apps from the single lockfile, and `lint`, `typecheck`, `test` and `build` all pass from the root. (Task 4, Step 2.)

---

### Task 0: Commit the design artifacts

- [ ] **Step 1: Commit**

```bash
git add GLOSSARY.md docs/superpowers .issues/issues/SCH-3
git commit -m "docs: add SCH-3 design, plan and glossary (SCH-3)"
```

### Task 1: Workspace root and Postgres in compose (criteria 1, 7)

**Files:**
- Create: `package.json` (root), `.gitignore`, `docker-compose.yml`, `api/.env.example`

**Interfaces:**
- Produces: `api/.env` variable names (see Global Constraints), which Task 2 reads, and the compose service `db`.

- [ ] **Step 1: Create the root `package.json`**

`"private": true`, `"workspaces": ["api", "web"]`, `"engines": { "node": ">=22" }`, and these scripts (the workspaces are filled in by Tasks 2 and 3):

```json
"dev:api": "npm run start:dev -w api",
"dev:web": "npm run dev -w web",
"test": "npm test -w api",
"lint": "npm run lint --workspaces",
"typecheck": "npm run typecheck --workspaces",
"build": "npm run build --workspaces"
```

- [ ] **Step 2: Create `.gitignore`** with `node_modules`, `dist`, `.next`, `.env`, `.env.local`, `.DS_Store`, `coverage`, `next-env.d.ts` and `*.tsbuildinfo`.

- [ ] **Step 3: Create `docker-compose.yml` and `api/.env.example`**

The service is `db`, using `image: postgres:16` and `env_file: ./api/.env`, with `ports: ["5432:5432"]` and a named volume `pgdata:/var/lib/postgresql/data`. The healthcheck is `["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]` with interval 2s and 15 retries. `api/.env.example` holds the six variables with the dev defaults from Global Constraints.

- [ ] **Step 4: Verify the missing-env failure (Review Focus 1)**

Run: `docker compose up -d db` (no `api/.env` yet)
Expected: an error mentioning `api/.env` not found.

- [ ] **Step 5: Verify healthy Postgres**

Run: `cp api/.env.example api/.env && docker compose up -d db && sleep 5 && docker compose ps db`
Expected: the `db` status shows `(healthy)`. Then run `docker compose exec db psql -U bookings -d bookings -c 'select version()'` and expect `PostgreSQL 16`.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore docker-compose.yml api/.env.example
git commit -m "chore: add npm workspace root and Postgres 16 in docker compose (SCH-3)"
```

### Task 2: Nest API with config, DatabaseModule and GET /health (criteria 2, 4)

**Files:**
- Create (generator): `api/` via `npx @nestjs/cli@latest new api --skip-git --skip-install --package-manager npm --strict`
- Delete: `api/src/app.controller.ts`, `api/src/app.service.ts`, `api/src/app.controller.spec.ts`, `api/test/` (e2e spec and `jest-e2e.json`), the `test:e2e` script, and `api/README.md`
- Create: `api/src/config/validate-env.ts`, `api/src/database/database.module.ts`, `api/src/health/health.controller.ts`, `api/src/health/health.controller.spec.ts`
- Modify: `api/src/app.module.ts`, `api/src/main.ts`, `api/package.json` (scripts)

**Interfaces:**
- Consumes: the `api/.env` variable names from Task 1.
- Produces:
  - `validateEnv(config: Record<string, unknown>): Record<string, unknown>`
  - `DatabaseModule`, which provides the TypeORM `DataSource` that SCH-4 builds on
  - `HealthController` with `GET /health` → `{ status: 'ok' }` or 503
  - The api scripts `start:dev`, `test`, `lint`, `typecheck`, `build`

- [ ] **Step 1: Generate and prune**

Run the generator above, delete the listed files, and remove `--fix` from the `lint` script. Add `"typecheck": "tsc --noEmit"`. Run `npm install` at the root, then `npm install -w api @nestjs/config @nestjs/typeorm typeorm pg`. Delete `api/package-lock.json` if one appeared.

- [ ] **Step 2: Write the failing test `api/src/health/health.controller.spec.ts`**

Build the controller with `Test.createTestingModule({ controllers: [HealthController], providers: [{ provide: DataSource, useValue: { query } }] })`, where `query` is a `jest.fn()`.

```ts
it('returns ok when SELECT 1 succeeds', async () => {
  query.mockResolvedValue([{ '?column?': 1 }]);
  await expect(controller.check()).resolves.toEqual({ status: 'ok' });
  expect(query).toHaveBeenCalledWith('SELECT 1');
});

it('throws ServiceUnavailableException when the query fails', async () => {
  query.mockRejectedValue(new Error('connection lost'));
  await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npm test -w api -- health`
Expected: FAIL, because `HealthController` can't be resolved.

- [ ] **Step 4: Implement `HealthController`** (`@Controller('health')`, `@Get() check(): Promise<{ status: 'ok' }>`)

It injects `DataSource` from `typeorm`, awaits `query('SELECT 1')` and catches any error, rethrowing `new ServiceUnavailableException()`.

- [ ] **Step 5: Run it and see it pass**

Run: `npm test -w api`
Expected: 2 passing tests, 1 suite.

- [ ] **Step 6: Wire config, the database and the port**

- `validateEnv` throws `new Error('Missing environment variables: ' + missing.join(', '))` when any required name is absent or empty, and otherwise returns `config`.
- `AppModule` imports `ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnv })` and `DatabaseModule`, and declares `HealthController`.
- `DatabaseModule` uses `TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory })`, returning:
  - `type: 'postgres'`
  - host, port (as a `Number`), username, password and database from `ConfigService.getOrThrow`
  - `retryAttempts: 3`, `migrationsRun: true`, `autoLoadEntities: true`, `synchronize: false`
  - `migrations: [__dirname + '/migrations/*.js']` (plan call: the spec's `*.{ts,js}` would also match the `.d.ts` files Nest emits with `declaration: true`, which TypeORM can't load)
- `main.ts` listens on `Number(app.get(ConfigService).getOrThrow('API_PORT'))`.

- [ ] **Step 7: Verify the config failure (Review Focus 2)**

Run: `cd api && POSTGRES_DB= npm run start` (with `api/.env` present; the empty shell value overrides the file)
Expected: the process exits with `Missing environment variables: POSTGRES_DB`.

- [ ] **Step 8: Verify against real Postgres (Review Focus 3, 4)**

With `db` healthy, run `npm run dev:api`, then `curl -i localhost:3001/health`. Expect `200` and `{"status":"ok"}`.

Run `docker compose stop db` and curl again. Expect `503`.

Stop the API, then start it again with `db` still stopped. Expect it to exit after 3 retry log lines.

Finish with `docker compose start db`.

- [ ] **Step 9: Lint, typecheck and commit**

Run: `npm run lint -w api && npm run typecheck -w api && npm run build -w api`
Expected: all exit 0.

```bash
git add api package.json package-lock.json
git commit -m "feat: scaffold Nest API with config validation, TypeORM and GET /health (SCH-3)"
```

### Task 3: Next.js web app with shadcn/ui (criterion 3)

**Files:**
- Create (generator): `web/` via `npx create-next-app@latest web --ts --app --tailwind --eslint --use-npm --skip-install --disable-git --import-alias "@/*" --yes`, then `npx shadcn@latest init -d` and `npx shadcn@latest add button` inside `web/`
- Modify: `web/src/app/page.tsx` (or `web/app/page.tsx`, depending on what the generator created), `web/package.json` (scripts)
- Delete: `web/README.md`, and `web/package-lock.json` if any step created one

**Interfaces:**
- Produces: the web scripts `dev`, `lint`, `typecheck`, `build`, and the `@/components/ui/button` component that SCH-10 builds on.

- [ ] **Step 1: Generate, add shadcn, prune**

Run the generators. Run `npm install` at the root. Add `"typecheck": "tsc --noEmit"`, and make sure `lint` doesn't pass `--fix`.

- [ ] **Step 2: Replace the home page**

Replace the generated content with a page that renders `<Button>` from `@/components/ui/button` and a heading "Bookings". Remove the generator's unused assets from `public/`.

- [ ] **Step 3: Verify**

Run `npm run dev:web` and `curl -s localhost:3000 | grep -o 'data-slot="button"'`. Expect a match.

Run `npm run lint -w web && npm run typecheck -w web && npm run build -w web` and expect all to exit 0.

- [ ] **Step 4: Commit**

```bash
git add web package.json package-lock.json
git commit -m "feat: scaffold Next.js web app with Tailwind and shadcn/ui (SCH-3)"
```

### Task 4: Root checks and CLAUDE.md (criteria 5, 6)

**Files:**
- Modify: `CLAUDE.md` (the "No application code exists yet…" paragraph)

- [ ] **Step 1: Update `CLAUDE.md`**

Replace that paragraph with a "Commands" section:
- One-time setup: `cp api/.env.example api/.env`, `npm install`, `docker compose up -d db`
- Run: `npm run dev:api` (port 3001) and `npm run dev:web` (port 3000)
- Check: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
- Single test: `npm test -w api -- -t "<name>"` or `npm test -w api -- <path>`

- [ ] **Step 2: Fresh-clone check (Review Focus 5)**

Run: `rm -rf node_modules api/node_modules web/node_modules && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
Expected: every command exits 0. `git ls-files | grep -E '(api|web)/package-lock.json|\.env$'` prints nothing.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: list setup, run, test and build commands in CLAUDE.md (SCH-3)"
```
