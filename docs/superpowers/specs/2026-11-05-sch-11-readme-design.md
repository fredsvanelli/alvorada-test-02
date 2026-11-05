# SCH-11: README with setup, run, tests, demo, decisions and what is left

Sharpened spec from the grill session on SCH-11. Inputs: `.issues/issues/SCH-11/issue.md`, `.issues/docs/PRD.md` ("What to deliver", "Repository and documentation"), `GLOSSARY.md` (updated in the grill: **Availability check**, **Id taken**), `docs/adr/0002-availability-answers-id-taken-as-409.md` (added in the grill), `CLAUDE.md` and `.github/workflows/ci.yml`.

## Why

The PRD makes the README the reviewer's entry point. Someone who clones the repo must be able to install, run, test and follow the demo from it alone, and then read why the solution looks the way it does. Today `README.md` has a one-line summary and two links.

## Goals

- A reviewer goes from a fresh clone to the running app, the passing tests and a finished demo by following the README from top to bottom, with no other source.
- Every acceptance criterion of SCH-11 is met: case, focus and time; setup, run and tests; a reproducible demo; up to three highlighted tests; two decisions; how AI was used; what is left; no credentials or real personal data.

## Non-goals

- The walkthrough video. It is not linked.
- API reference docs. `api/openapi.yaml` is linked instead.
- Code changes, except the new `.nvmrc`.
- The gaps the user chose to leave out of "What is left": CI gaps, the `view-home` runbook script, the canceled SCH-9 PRD replay and the video.

## Anti-goals

- A demo step whose written output was never seen. Each command and expected output is run once before it is written down.
- Words the glossary rules out: "slot", "period", "reservation", "deleted", "Cancelled".
- Real credentials or personal data. Only the local Docker defaults from `api/.env.example` appear, and only by reference to that file.

## Language and audience

English, using the glossary terms (**Resource**, **Booking**, **Interval**, **Active** / **Canceled**, **Cancel**, **Conflict**, **Rejection**, **Availability check**, **Id taken**, **Ascending id order**). The reader is a reviewer who clones the repo and reads from top to bottom.

## Sections, in order

1. **Title, case, focus, time**
   - The title is "Conflict-free bookings", followed by a one-line summary.
   - Case 02.
   - Focus: full stack, with the emphasis on the back end (the booking rules, the API contract and the tests). The UI is how the rules are shown.
   - Time spent: "About 6 hours", in one line, with no breakdown and no justification.
2. **Docs**: links to the PRD (`.issues/docs/PRD.md`), the architecture diagrams (`docs/diagrams/architecture.md`), `GLOSSARY.md`, `docs/adr/`, `api/openapi.yaml` and `docs/runbooks/README.md`.
3. **Setup**
   - Prerequisites: NVM, Node 22.18 or newer on the 22 line (pinned as `22` in `.nvmrc`), npm 10 or newer, and Docker with Compose. The npm 11 workaround for adding dependencies is not mentioned.
     - My call: the README asks for "22.18 or newer" because the web unit tests run `.ts` files with `node --test`. That needs type stripping, which is on by default from Node 22.18.
   - Steps: `nvm install` (first time only), `nvm use`, `cp api/.env.example api/.env`, `npm install`, `docker compose up -d db`.
     - My call: `nvm install` is listed before `nvm use`, because `nvm use` fails when no Node 22 is installed.
   - New file `.nvmrc` containing `22`, the same version as CI's `node-version: 22`. CI is not changed.
4. **Run**
   - `npm run dev:api` serves port 3001. On start it runs the migrations and seeds R1 to R5. `GET /health` checks the database.
   - `npm run dev:web` serves port 3000.
5. **Tests**
   - `npm test`: the api and web unit tests, plus the api runbook scripts. Postgres must be up. It uses the disposable database `bookings_test`, recreated on every run, so it never touches the dev data.
   - `npm run test:e2e`: the UI runbook scripts (Playwright) against recorded fixtures. Ports 3000 and 4010 must be free. It needs no API and no Postgres.
     - It needs a one-time `npx playwright install chromium`, run from `web/`. My call: without it, `test:e2e` fails on a fresh clone. CI runs the same step.
   - `npm run lint`, `npm run typecheck`, `npm run build`.
   - The runbooks (`docs/runbooks/README.md`) are the official record of how the product behaves.
6. **Demo**: the PRD example, first in the UI, then with `curl`.
   - Optional reset first: `docker compose down -v && docker compose up -d db`, with a warning that it deletes local data. A fresh clone starts empty. After a reset the API must be restarted so it migrates and seeds again.
   - **UI** (http://localhost:3000). The UI prevents rejections: a Conflict or a taken id never reaches the POST.
     1. Create A on R1 `[10,20)`, then B on R1 `[20,30)`. B starts where A ends.
     2. Type C on R1 `[19,21)`. The preview shows a Conflict with A and B, the timeline rings both, and Book is disabled. Nothing is created.
     3. Switch to R2. The preview shows the Interval is available, and C is created.
     4. Cancel A through the confirm dialog. R1 `[10,20)` is free again.
     5. Type A on R1 `[10,20)`. The preview shows "Id A was already used by another booking".
   - **Reset between the parts** (decided after the builder check): the UI part leaves A, B and C behind, and ids are never reused. So before the curl part, run `docker compose down -v && docker compose up -d db` and restart `npm run dev:api`, then repeat the same scenario with the same ids.
   - **curl**: the same scenario with the API's real answers.
     - Create A and B.
     - Create C on R1: `409 conflict` with A and B.
     - Create C on R2: `201`.
     - `GET /availability?resource=R1&start=19&end=21`: `{ "available": false, "conflicts": ["A","B"] }`.
     - Cancel A.
     - `GET /availability?resource=R1&start=10&end=20`: available.
     - Create A again: `409 id_taken`.
     - `GET /availability?resource=R1&start=10&end=20&id=A`: `409 id_taken`.
     - Each step shows the command (`curl -s -w '\n%{http_code}\n'`) and, below it, the literal status and JSON body.
7. **Highlighted tests**: three, each with the command that runs it alone, the expected result and the kind of error it catches.
   - (a) `overlaps`, case "touching: a ends where b starts" (`api/src/bookings/booking-rules.spec.ts`).
     - Expected: `[10,20)` vs `[20,30)` is `false`, in both orders.
     - Catches: `<=` instead of `<`, and an asymmetric rule.
   - (b) `bookings.create-booking` S09 "A rejected id stays free, and another resource never conflicts" (`api/test/runbooks/bookings-create-booking.spec.ts`).
     - Expected: C is rejected on R1 with Conflicts A and B, then accepted on R2 with 201.
     - Catches: a write before validation finishes, which leaves the id taken.
   - (c) `bookings.check-availability` S04 "Conflicting ids are ordered by character code" (`api/test/runbooks/bookings-check-availability.spec.ts`).
     - Expected: `["10","9","B","a"]`.
     - Catches: ordering by the database collation or by creation order.
8. **Decisions**: two, each covering what was checked, how it was investigated and what was concluded.
   - (a) The `[start, end)` rule lives in one pure module, `api/src/bookings/booking-rules.ts` (`overlaps()` and `parseInterval()`). The story is the one recorded in SCH-4 and SCH-5 (decided after the builder check); no other alternatives are invented.
     - Checked: create and availability must never disagree, and an invalid time must never reach the database as a 500.
     - Investigated: the time columns are Postgres `integer` (SCH-4), so a time above 2147483647 must be rejected as `invalid_data`. Query strings arrive as text, which led to renaming `validInterval` to `parseInterval`, accepting digit-only strings.
     - Concluded: one module with no Nest or TypeORM imports, shared by create and availability, with table tests that check each `overlaps` case in both orders.
   - (b) `id_taken` on the Availability check (ADR 0002).
     - The starting observation: the UI learned an id was taken only after the POST.
     - The AI recommended a 200 with an `idTaken` field.
     - The user chose `409 id_taken`, so the check gives the same answer, in the same order, as the create it predicts.
     - This is the AI-suggestion example.
9. **How AI was used**
   - The actual workflow: issues in pmkit (`.issues/`); grilling, then brainstorming into a spec in `docs/superpowers/specs/`; TDD with Claude Code; `review-work` before each PR; runbooks as UAT, verified by scripts.
   - What was kept and what changed: decision (b) is the example.
   - How the result was checked: tests, runbooks and human review of each plan and design.
10. **What is left**
    - Concurrency, a known limit. Check-then-insert is not atomic, so two simultaneous creates can overlap. The upgrade path is a Postgres exclusion constraint (`EXCLUDE USING gist` on the resource and the range, for Active bookings).
    - On a separate line, what the PRD puts out of scope: authentication, payment and recurring bookings.

## Constraints

- The demo output is captured from a real run on a reset database, with the API from this branch.
- `README.md` is the only document rewritten. `CLAUDE.md` is not changed, because its commands section already matches.
- The commit message follows the convention, for example `docs: write the README (SCH-11)`.

## Left to the builder

- Wording, headings and the length of each section, within the order above.
- Whether the `curl` steps are one code block each or grouped, as long as each step's output sits right under its command.
- The command that runs each highlighted test alone, built from the CLAUDE.md patterns (`npm test -w api -- -t "<name>"` or a file filter).
