---
id: SCH-14
title: "Run the web unit tests, lint, typecheck and build in CI"
type: feature
status: done
estimate: 2
assignee: fred-vanelli
related: [SCH-11]
branch: sch-14-run-the-web-unit-tests-lint-typecheck
created: 2026-11-05T19:35:05.530Z
updated: 2026-11-06T00:56:36Z
---

## Description

### Context

Found while writing the README (SCH-11). `.github/workflows/ci.yml` runs two commands on a pull request to `main`: `npm test -w api` (job `api-tests`) and `npm run test:e2e` (job `web-e2e`). The web unit tests, lint, typecheck and build run only on a developer's machine, so a pull request that breaks them still gets green checks.

### Scope (in)

- Run these commands in CI on every pull request to `main`: `npm test -w web`, `npm run lint`, `npm run typecheck` and `npm run build`. The last three cover both workspaces.

### Out of scope

- Making checks required in the repository's branch protection settings.
- Changing what `api-tests` and `web-e2e` run.
- Widening what the lint scripts cover. `api` lints only `src/`.

## Acceptance criteria

- [ ] A pull request to `main` runs `npm test -w web` in CI
- [ ] A pull request to `main` runs `npm run lint`, `npm run typecheck` and `npm run build` in CI, for both workspaces
- [ ] A failure in any of those commands fails the pull request's checks
- [ ] `api-tests` and `web-e2e` still run and pass on the pull request
- [ ] Update [README.md](http://README.md) (Tests section)