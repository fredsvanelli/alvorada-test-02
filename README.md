# Conflict-free bookings

A booking system for a team's shared Resources that rejects overlapping Bookings, on the half-open rule `[start, end)`.

- **Case:** Case 02, Conflict-free bookings.
- **Focus:** full stack, with the emphasis on the back end: the booking rules, the API contract and the tests. The web app is how the rules are shown.
- **Time spent:** about 6 hours.

Stack: Next.js (TypeScript, Tailwind, shadcn/ui) calling a Nest.js REST API (TypeScript), which stores data in Postgres 16 running in Docker.

## Docs

- [PRD](.issues/docs/PRD.md): the challenge as given.
- [Architecture diagrams](docs/diagrams/architecture.md): containers, data model, backend modules and booking flows.
- [Glossary](GLOSSARY.md): the domain terms this README uses (Resource, Booking, Interval, Conflict, Availability check, Id taken).
- [Architecture decision records](docs/adr/).
- [API contract](api/openapi.yaml) (OpenAPI 3.1).
- [Runbooks](docs/runbooks/README.md): the official record of how the product behaves, one runbook per flow.

## Setup

Prerequisites:

- [NVM](https://github.com/nvm-sh/nvm)
- Node 22.18 or newer on the 22 line, pinned in `.nvmrc`. The web unit tests run `.ts` files with `node --test`, which needs Node 22.18 or newer.
- npm 10 or newer
- Docker with Compose

From the repo root:

```sh
nvm install   # first time only: installs the version in .nvmrc
nvm use
cp api/.env.example api/.env
npm install
docker compose up -d db
```

`api/.env` holds the local Postgres settings, and Docker Compose reads the same file. The defaults work as they are.

## Run

Run each command in its own terminal:

```sh
npm run dev:api   # API on http://localhost:3001
npm run dev:web   # web app on http://localhost:3000
```

On start, the API runs the database migrations, which also seed the five Resources R1 to R5. `GET http://localhost:3001/health` answers `{"status":"ok"}` when the API can reach the database.

## Tests

| Command | What it runs | What it needs |
|---|---|---|
| `npm test` | API unit tests, web unit tests and the API runbook scripts | Postgres up (`docker compose up -d db`) |
| `npm run test:e2e` | The UI runbook scripts (Playwright), replaying recorded API answers | Ports 3000 and 4010 free. No API, no Postgres. Run `npx playwright install chromium` from `web/` once beforehand |
| `npm run lint`, `npm run typecheck`, `npm run build` | Lint, type checks and production builds of both apps | Nothing running |

`npm test` never touches your data. It uses a separate database, `bookings_test`, which is dropped, recreated and migrated before every run.

## Demo

This demo replays the PRD example, first in the web app and then with `curl`. A fresh clone starts with no Bookings. To start over at any point, reset the database and restart the API, so it migrates and seeds again:

```sh
docker compose down -v && docker compose up -d db   # deletes all local Bookings
npm run dev:api
```

### In the web app

Open http://localhost:3000. As you fill the Operation form, the page asks the API whether the Interval is available, and whether the Id is still free. A Booking that would be rejected never reaches the create, so Book stays disabled.

1. **Book A and B.** Enter Id `A`, Resource R1, Start `10`, End `20`, and click Book. Then enter `B`, R1, `20` to `30`, and click Book. Both are created. B is accepted because it starts exactly where A ends: R1 is free again at 20.
2. **Try C on R1.** Enter `C`, R1, `19` to `21`. The preview reads "R1 [19,21) conflicts with A, B", the timeline rings A and B, and Book is disabled. Nothing is created.
3. **Book C on R2.** Switch the Resource to R2. The preview reads "R2 [19,21) is available". Click Book, and C is created. The rejected attempt on R1 did not take the id C, and Bookings of another Resource never conflict.
4. **Cancel A.** In the Bookings table, click Cancel on A and confirm. The dialog says that R1 [10,20) becomes free and that the id A stays taken. A now shows as Canceled.
5. **Try A again.** Enter `A`, R1, `10` to `20`. The preview reads "Id A was already used by another booking", and Book is disabled. The Interval is free, but a created Booking's id is never reused.

### With curl

The web app has just created A, B and C, and ids are never reused, so reset the database and restart the API (see above) before you run these. Each command is followed by the body and the HTTP status the API answers.

1. Book A on R1 `[10,20)`:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings -H 'Content-Type: application/json' -d '{"id":"A","resource":"R1","start":10,"end":20}'
   ```

   ```
   {"id":"A","resource":{"id":"R1","name":"Agora Room"},"start":10,"end":20,"status":"active"}
   201
   ```

2. Book B on R1 `[20,30)`. It starts where A ends:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings -H 'Content-Type: application/json' -d '{"id":"B","resource":"R1","start":20,"end":30}'
   ```

   ```
   {"id":"B","resource":{"id":"R1","name":"Agora Room"},"start":20,"end":30,"status":"active"}
   201
   ```

3. C on R1 `[19,21)` is rejected with its Conflicts, in ascending id order:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings -H 'Content-Type: application/json' -d '{"id":"C","resource":"R1","start":19,"end":21}'
   ```

   ```
   {"error":"conflict","message":"The interval overlaps active bookings of this resource.","conflicts":["A","B"]}
   409
   ```

4. C on R2 `[19,21)` is accepted. The rejection did not take the id:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings -H 'Content-Type: application/json' -d '{"id":"C","resource":"R2","start":19,"end":21}'
   ```

   ```
   {"id":"C","resource":{"id":"R2","name":"Pixel Room"},"start":19,"end":21,"status":"active"}
   201
   ```

5. Check R1 `[19,21)` without booking it:

   ```sh
   curl -s -w '\n%{http_code}\n' 'http://localhost:3001/availability?resource=R1&start=19&end=21'
   ```

   ```
   {"available":false,"conflicts":["A","B"]}
   200
   ```

6. Cancel A:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings/A/cancel
   ```

   ```
   {"result":"canceled","booking":{"id":"A","resource":{"id":"R1","name":"Agora Room"},"start":10,"end":20,"status":"canceled"}}
   200
   ```

7. R1 `[10,20)` is available again:

   ```sh
   curl -s -w '\n%{http_code}\n' 'http://localhost:3001/availability?resource=R1&start=10&end=20'
   ```

   ```
   {"available":true,"conflicts":[]}
   200
   ```

8. The id A stays taken, both for a create and for an Availability check that names it:

   ```sh
   curl -s -w '\n%{http_code}\n' -X POST http://localhost:3001/bookings -H 'Content-Type: application/json' -d '{"id":"A","resource":"R1","start":10,"end":20}'
   curl -s -w '\n%{http_code}\n' 'http://localhost:3001/availability?resource=R1&start=10&end=20&id=A'
   ```

   ```
   {"error":"id_taken","message":"This id was already used by another booking."}
   409
   {"error":"id_taken","message":"This id was already used by another booking."}
   409
   ```

To see every Booking with its status, run `curl -s http://localhost:3001/bookings`. A shows as `canceled`, and B and C show as `active`.

## Highlighted tests

Each command runs one test on its own. Postgres must be up, because the test run recreates `bookings_test` first.

1. **Touching Intervals do not overlap**: the `overlaps` case "touching: a ends where b starts", in `api/src/bookings/booking-rules.spec.ts`.

   ```sh
   npm test -w api -- src/bookings/booking-rules.spec.ts -t "touching"
   ```

   - Expected: `[10,20)` against `[20,30)` is not an overlap, in both argument orders.
   - Catches: a closed-interval comparison (`<=` instead of `<`), which would reject B in the demo. Also catches a rule that gives different answers depending on which Booking comes first.

2. **A rejected id stays free**: `bookings.create-booking` S09, in `api/test/runbooks/bookings-create-booking.spec.ts`.

   ```sh
   npm test -w api -- test/runbooks/bookings-create-booking.spec.ts -t "S09"
   ```

   - Expected: over HTTP against the real database, C on R1 `[19,21)` answers `409 conflict` with `["A","B"]`, then C on R2 `[19,21)` answers `201`.
   - Catches: a create that writes the row before every check passes, which would leave the id C taken by a Booking that was rejected.

3. **Conflicts come back in ascending id order, by character code**: `bookings.check-availability` S04, in `api/test/runbooks/bookings-check-availability.spec.ts`.

   ```sh
   npm test -w api -- test/runbooks/bookings-check-availability.spec.ts -t "S04"
   ```

   - Expected: with Bookings `B`, `a`, `10` and `9` created in that order, the conflicts are `["10","9","B","a"]`.
   - Catches: ordering by the database's locale collation, by numeric value, or by creation order, any of which gives a different list.

## Decisions

### 1. The `[start, end)` rule lives in one pure module

- **What was checked:** create and the Availability check must never disagree about whether two Intervals overlap. An invalid time must never reach the database and come back as a 500.
- **How it was investigated:**
  - The time columns are Postgres `integer`, so a time above 2147483647 would fail inside the database. That set the valid range, `0..2147483647`, for the parse step.
  - Query strings reach the API as text. So the validation function became `parseInterval` (it was planned as `validInterval`), and it accepts integers or digit-only strings and returns the Interval or `null`.
- **What was concluded:** `api/src/bookings/booking-rules.ts` holds `parseInterval()` and `overlaps()`, with no Nest or TypeORM imports. `BookingsService` uses the same two functions for create and for availability, so they cannot drift apart. The tests are tables of boundary cases, and each `overlaps` case is checked in both argument orders.

### 2. The Availability check answers a taken id with `409 id_taken`

- **What was checked:** in the web app, a taken id only showed up after clicking Book. The preview said the Interval was available, and then the create was rejected with `id_taken`. The check only asked about the Interval, never the id.
- **How it was investigated:**
  - The AI assistant proposed letting `GET /availability` take an optional `id` and return a `200` with a new `idTaken` field next to `available` and `conflicts`. That would show the taken id and the Conflicts together.
  - The alternative was to answer exactly like a create would: `409 id_taken`, checked in the create's order (`invalid_data`, `unknown_resource`, `id_taken`, then the Conflicts).
- **What was concluded:**
  - The `409` was chosen, so the check gives the same answer, in the same order, as the create it predicts. Without `id`, the answer is unchanged.
  - The trade-off: with a taken id, the answer lists no Conflicts.
  - Recorded in [ADR 0002](docs/adr/0002-availability-answers-id-taken-as-409.md) and in the contract (`api/openapi.yaml`).

## How AI was used

The work was done with Claude Code, through a fixed workflow for each issue:

1. The issues live in the repo (`.issues/`, managed with pmkit). Each one has acceptance criteria and its own branch.
2. Before any code, a question-and-answer session sharpens the issue against the PRD and the glossary (grilling). It updates `GLOSSARY.md` and `docs/adr/` when a term or a hard-to-reverse decision comes up, and it ends in a written design in `docs/superpowers/specs/`.
3. A plan comes from that design. Implementation follows test-driven development: a failing test first, then the code.
4. Before each pull request, an automated review checks the branch against the issue. Its findings are fixed or listed with a reason.
5. Each flow has a runbook in `docs/runbooks/`, verified by a test script: Vitest over HTTP for the API, Playwright for the web app.

What was kept and what changed: the AI drafted the designs, the code and the tests. Every design and plan was reviewed and approved before any code was written, and a suggestion that did not fit was replaced. Decision 2 above is the example: the AI's `200` with `idTaken` was replaced by `409 id_taken`.

How the result was checked: the unit tests, the runbook scripts and the CI run on every pull request (`.github/workflows/ci.yml`), plus a manual run of this demo in the browser and with `curl`.

## What is left

- **Concurrency:** this is a known limit. A create checks for Conflicts and then inserts, and the two steps are not atomic. So two creates sent at the same moment can both pass the check and overlap. The upgrade path is a Postgres exclusion constraint (`EXCLUDE USING gist`) on the Resource and the Interval, for Active Bookings, so the database itself rejects the overlap.
- **Out of scope by the PRD:** authentication, payment and recurring bookings.
