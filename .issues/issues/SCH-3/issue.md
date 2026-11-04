---
id: SCH-3
title: "Scaffold the Nest.js API, the Next.js web app (Tailwind + shadcn/ui) and Postgres 16 in docker compose"
type: chore
status: in_review
estimate: 3
assignee: fred-vanelli
parent: SCH-2
branch: sch-3-scaffold-the-nest-js-api-the-next-js-web
created: 2026-11-04T20:00:44.123Z
updated: 2026-11-04T22:19:21Z
---

## Description

### Context

First step of SCH-2. Set up the three runnable pieces from the containers view in `docs/diagrams/architecture.md`, so later issues only add behavior: a Nest.js REST API, a Next.js web app and Postgres 16 in Docker. Only Postgres runs in Docker; both apps run on the host.

### Scope (in)

- `docker-compose.yml` with a `db` service: Postgres 16 on localhost:5432, a named volume and a healthcheck
- Nest.js API in TypeScript with `DatabaseModule` connecting to that Postgres, configured through environment variables
- Next.js app in TypeScript with Tailwind and shadcn/ui initialized
- A test runner in the API (the one SCH-5 and SCH-6 will use) with one passing test
- The build, test and single-test commands in `CLAUDE.md`

### Out of scope

- Tables, seed data and `GET /resources` (SCH-4)
- `booking-rules.ts` (SCH-5) and the booking endpoints (SCH-6 to SCH-8)
- The UI from `.design/` (SCH-10) and the README (SCH-11)

### Open questions for the design step

- Repository layout: two folders (`api/`, `web/`) or a workspace
- How the API talks to Postgres (driver or ORM) and how the schema will be applied in SCH-4
- How the web app finds the API (base URL env var, CORS)

## Acceptance criteria

- [ ] `docker compose up -d db` starts Postgres 16 on localhost:5432 and the service reports healthy
- [ ] The API starts with one command and a request to it proves it reached Postgres
- [ ] The web app starts with one command and renders a page built with a shadcn/ui component
- [ ] The API test command runs and one test passes
- [ ] Lint and type checks pass in both apps
- [ ] `CLAUDE.md` lists the build, test and single-test commands
- [ ] Only local development defaults are committed, with no real credentials
