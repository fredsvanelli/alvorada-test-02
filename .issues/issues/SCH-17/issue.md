---
id: SCH-17
title: Start the Playwright MCP servers on a fresh clone without .env.local
type: bug
status: backlog
related: [SCH-16]
created: 2026-11-06T02:17:39.503Z
updated: 2026-11-06T02:17:48Z
---

## Description

### Context

`.mcp.json` starts `runbooks-playwright` and `runbooks-playwright-headed` with `--secrets .env.local`. `.env.local` is ignored by git, so a fresh clone does not have it. Both servers then crash at startup with `ENOENT` on `.env.local`, and Claude Code reports `CONNECTION_CLOSED`.

Found during SCH-16. An empty `.env.local` in the repo root let the server start when run directly. In that session `/mcp` then reconnected `runbooks-playwright-headed`; `runbooks-playwright` did not reconnect, and the cause of that was not investigated.

### Scope (in)

- Make both servers start on a fresh clone, by documenting the file in the setup steps or by no longer requiring it.
- Find out why `runbooks-playwright` stayed down while the headed server reconnected.
