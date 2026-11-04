# SCH-3: scaffold the API, the web app and Postgres

Issue: `.issues/issues/SCH-3/issue.md` (parent SCH-2). Product spec: `.issues/docs/PRD.md`. Architecture: `docs/diagrams/architecture.md`. Vocabulary: `GLOSSARY.md`.

## Intent

The repo has no application code. SCH-3 sets up the three runnable pieces from the containers view (Nest.js API, Next.js web app, Postgres 16 in Docker) so that SCH-4 to SCH-10 only add behavior and never touch tooling. Anyone who clones the repo must be able to start each piece with one command after a one-time env copy, because the PRD reviewers will follow the README to run it.

## Goals

These are the issue's acceptance criteria.

1. `docker compose up -d db` starts Postgres 16 on localhost:5432 and the service reports healthy.
2. The API starts with one command, and a request to it proves it reached Postgres.
3. The web app starts with one command and renders a page built with a shadcn/ui component.
4. The API test command runs and one test passes.
5. Lint and type checks pass in both apps.
6. `CLAUDE.md` lists the build, test and single-test commands.
7. Only local development defaults are committed, with no real credentials.

## Non-goals (owned by later issues)

- Tables, the `CHECK start_time < end_time`, seeding R1 and R2, `GET /resources`, the first migration and the TypeORM CLI data source: SCH-4.
- `booking-rules.ts`: SCH-5. The booking endpoints: SCH-6 to SCH-8.
- Wiring the web app to the API (`web/.env.local`, `web/.env.example`, `NEXT_PUBLIC_API_URL` or rewrites, CORS): SCH-10. The `.design/` look and layout: SCH-10.
- The README: SCH-11.

## Anti-goals

- No scaffolding "for later": no empty migration, no placeholder modules (`ResourcesModule`, `BookingsModule`), no unused env vars, no web-to-API client.
- No extra tooling beyond what the generators ship: no Turborepo, no `concurrently`, no Joi, no `@nestjs/terminus`, no Docker for the apps.
- No real credentials in git.

## Decisions (agreed with the user)

### Layout

- npm workspaces with a root `package.json` listing `api` and `web`, using npm (pnpm isn't installed), with `"engines": { "node": ">=22" }`.
- A root `.gitignore` covering `node_modules`, `dist`, `.next`, `.env`, `.env.local`, `.DS_Store` and `coverage`. The untracked `.design/.DS_Store` disappears from `git status` as a result.

### Postgres (`docker-compose.yml` at the root)

- Service `db`, image `postgres:16`.
- `env_file: ./api/.env`. The image reads `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` from it.
- `ports: "5432:5432"`, hardcoded rather than interpolated.
- A named volume for `/var/lib/postgresql/data`.
- Healthcheck: `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`.
- If `api/.env` is missing, compose fails loudly. That's intended.

### API (`api/`)

- Generated with the Nest CLI. It keeps the CLI's test, lint and Prettier setup. Nest CLI 12 generates Vitest and oxlint (not Jest and ESLint); the user confirmed keeping Vitest during review.
- **Config:** `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate })`), where `.env` is `api/.env`. `validate` is a plain function that throws one error naming every missing variable.
- **Required variables:** `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `API_PORT`.
- **Env template:** `api/.env.example` is committed with dev defaults: `localhost`, `5432`, `bookings` / `bookings` / `bookings`, and `3001`. `api/.env` is gitignored.
- **Database:** `DatabaseModule` wraps `TypeOrmModule.forRootAsync` and reads `ConfigService`, with:
  - `type: 'postgres'`
  - `retryAttempts: 3`
  - `migrationsRun: true`
  - `migrations: [__dirname + '/migrations/*.{ts,js}']`, a glob that matches nothing yet
  - `autoLoadEntities: true`
  - `synchronize: false`
- **Startup:** the API needs the database to start. With Postgres down, it fails after the retries.
- **Health check:** `GET /health` runs `SELECT 1` through the TypeORM `DataSource`. It returns `200 { "status": "ok" }`, and `503` when the query throws. It's hand-written.
- **Port:** the API listens on `API_PORT` (3001).
- **Tests:** the one test covers the `/health` controller: 200 when the query succeeds and 503 when it throws, with the `DataSource` mocked. It's a unit test that needs no database. The generated hello-world `AppController` and `AppService` are deleted.

### Web (`web/`)

- `create-next-app` with TypeScript, the App Router, Tailwind and ESLint, then `shadcn init` and `shadcn add button`.
- The home page renders one shadcn `Button`.
- It runs on port 3000, the Next default.

### Root scripts

| Script | Runs |
|---|---|
| `dev:api` | the API in watch mode |
| `dev:web` | Next dev |
| `test` | the API's Vitest |
| `lint` | lint in both workspaces |
| `typecheck` | `tsc --noEmit` in both workspaces |
| `build` | `build` in both workspaces (builder's call, needed for goal 6) |

Single test: `npm test -w api -- -t "<name>"`, or pass a file path. Postgres is started with `docker compose up -d db` directly.

### `CLAUDE.md`

Replace "No application code exists yet…" with the setup steps (`cp api/.env.example api/.env`, `npm install`, `docker compose up -d db`), the scripts above and the single-test command.

### Domain

`GLOSSARY.md` is already written. No ADRs, because every choice is the conventional path.

## Calls made after the builder check

- **Generated e2e test:** remove the generated `test/app.e2e-spec.ts` and `test/jest-e2e.json` (they test the deleted hello-world controller). The API e2e setup arrives with SCH-9.
- **Generator leftovers:** run the generators with no nested git (`--skip-git`, `--disable-git`). Keep one root `package-lock.json` and delete the per-app lockfiles.
- **Check-only lint:** the workspace `lint` scripts don't pass `--fix`, so "lint passes" verifies something.

## Left to the builder

- Exact Next.js, Nest and TypeORM versions: the current stable releases.
- shadcn style and base color: the defaults. SCH-10 restyles them from `.design/`.
- Where the health controller lives (`src/health/`), and whether `validate` lives in its own file.
- Commit granularity on the branch, using conventional commits ending in `(SCH-3)`.
