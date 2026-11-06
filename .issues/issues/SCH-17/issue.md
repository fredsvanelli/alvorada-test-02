---
id: SCH-17
title: Start the Playwright MCP servers on a fresh clone without .env.local
type: bug
status: in_progress
estimate: 1
assignee: fred-vanelli
related: [SCH-16]
branch: sch-17-start-the-playwright-mcp-servers-on-a
created: 2026-11-06T02:17:39.503Z
updated: 2026-11-06T03:02:33Z
---

## Description

### Context

`.mcp.json` starts `runbooks-playwright` and `runbooks-playwright-headed` with `--secrets .env.local`. `.env.local` is ignored by git, so a fresh clone does not have it. Both servers then crash at startup with `ENOENT` on `.env.local`, and Claude Code reports `CONNECTION_CLOSED`.

Found during SCH-16. An empty `.env.local` in the repo root let the server start when run directly. In that session `/mcp` then reconnected `runbooks-playwright-headed`; `runbooks-playwright` did not reconnect, and the cause of that was not investigated.

### Scope (in)

- Remove `--secrets .env.local` from both servers in `.mcp.json`, so they start on a fresh clone. `accounts` in `docs/runbooks/runbooks.config.json` is empty, so the flag passes nothing today.
- Leave `mcp.secretsFile` in the runbooks config, because the plugin's loader fills in the same default without it. Add a line to the Runbooks section of `CLAUDE.md` that says why `.mcp.json` omits the flag and to restore it once `accounts` has entries, because `/runbooks:setup` and `/runbooks:settings mcp` can write it back.
- Record in a comment why `runbooks-playwright` stayed down while the headed server reconnected.
- Add a numbered README setup step, after the API environment step, that copies `web/.env.example` to `web/.env.local`, with the same note that the defaults work. Install becomes step 5.
- Update the `CLAUDE.md` setup lines to match.

### Scope (out)

- `web/.env.example` and `.github/workflows/ci.yml` stay unchanged.
- No automated test for `.mcp.json`. Check criterion 1 once, in a temporary `git clone` of the branch, and put the output in the PR.
- No runbook changes. Run `/runbooks:list --affected` and `/runbooks:run --affected`, and report what they return.
- Which browser the MCP servers need on a machine without Chrome. Test it and offer it as a follow-up issue.

## Acceptance criteria

- [x] With no `.env.local` in the repo root, both servers in `.mcp.json` start and answer an MCP `initialize` request. `.mcp.json` no longer passes `--secrets`.
- [x] The cause of `runbooks-playwright` staying down is recorded in a comment on SCH-17.
- [x] The README setup has a step that runs `cp web/.env.example web/.env.local`, and `npm run dev:web` works after following the steps in order.
- [x] `npm run test:e2e` passes with `web/.env.local` in place.
