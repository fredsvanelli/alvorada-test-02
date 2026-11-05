---
id: SCH-11
title: "Write the README: setup, run, tests, demo, decisions and what is left"
type: task
status: in_progress
estimate: 2
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-9, SCH-10]
branch: sch-11-write-the-readme-setup-run-tests-demo
created: 2026-11-04T20:00:44.994Z
updated: 2026-11-05T17:54:38Z
---

## Acceptance criteria

- [ ] The README states the case (Case 02), the focus chosen and the time spent
- [ ] It explains how to install, set up `.env` and the Docker Postgres, run the API and the web app, and run the tests
- [ ] It has a demo that someone who clones the repo can reproduce step by step
- [ ] It highlights up to three tests, each with the expected result and the kind of error it catches
- [ ] It describes two decisions: what was checked, how it was investigated and what was concluded
- [ ] It explains how AI was used, what was kept or changed and how the result was verified
- [ ] It lists what is left to do, and contains no credentials or real personal data

## Description

### Context

Last step of SCH-2, blocked by SCH-9 and SCH-10, so the app, the tests and the UI exist. The PRD ("What to deliver", "Repository and documentation") makes the README the reviewer's entry point: someone who clones the repo must be able to install, run, test and follow the demo from it alone.

Today `README.md` has a one-line summary and links to the PRD and the architecture diagrams.

### Scope (in)

- The case (Case 02), the focus chosen and the time spent
- Setup: Node and npm versions, `cp api/.env.example api/.env`, `npm install`, `docker compose up -d db`
- Run: `npm run dev:api` and `npm run dev:web`, with the ports
- Tests: `npm test` and the e2e script from SCH-9, and what each needs running
- A reproducible demo, step by step, in the UI or with `curl`, with the expected result of each step
- Up to three highlighted tests, each with the expected result and the kind of error it catches (candidates: the `[10,20)` / `[20,30)` boundary in SCH-5, the rejected id reused in SCH-6, the PRD replay in SCH-9)
- Two decisions: what was checked, how it was investigated and what was concluded (one can be about an AI suggestion)
- How AI was used, what was kept or changed and how the result was checked
- What is left to do, and the known limits (no concurrency control, by the PRD)
- Keep the links to the PRD, the architecture diagrams and `GLOSSARY.md`

### Out of scope

- The walkthrough video (out of scope in SCH-2); the README only links to it if it exists
- Changing code: gaps found while writing go to "What is left"
- API reference docs beyond the endpoint list the demo needs

### Open questions for the design step

- Which two decisions to describe? Candidates: Postgres instead of the in-memory store the PRD allows, the `[start, end)` rule in one pure function, check-then-insert without a lock, seeding R1 to R5 in the migration
- Demo in the UI, with `curl`, or both?
- A different scenario from the PRD example, as the PRD asks for the video, or the PRD example itself?
