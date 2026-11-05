---
id: SCH-15
title: Remove the 4m30 wait from test:e2e on WSL2 mirrored networking
type: bug
status: done
priority: medium
estimate: 1
branch: sch-15-remove-the-4m30-wait-from-test-e2e-on
created: 2026-11-05T22:38:06.248Z
updated: 2026-11-05T22:52:02Z
---

## Description

### Context

On WSL2 with `mirrored` networking, `npm run test:e2e` prints nothing for 4m30 before the first test and looks stuck. With `url` set in `webServer`, Playwright connects to that URL before it starts each server. In this networking mode, a connection to a closed `127.0.0.1` port often gets no answer until it fails with `ETIMEDOUT`, about 2m15 per server. The suite itself takes about 30 s. Developers on this setup lose up to 4m30 per run.

### Scope (in)

- Replace `url` with `wait.stdout` on both servers in `web/playwright.config.ts`
- Start the web server with an explicit port 3000, so the run fails when that port is taken

### Out of scope

- Changing WSL network settings or the Windows firewall
- Finding which Windows component drops the connection
- Running the e2e tests in CI

### Tasks

- [ ] Make the e2e tests start without the wait before the servers
- [ ] Keep the immediate failure when the web or fixture server port is taken

## Acceptance criteria

- [ ] With ports 3000 and 4010 free on WSL2 mirrored, `npm run test:e2e` finishes in under 1 minute and all tests pass
- [ ] With port 3000 taken, `npm run test:e2e` fails within seconds with a port-in-use error
- [ ] With port 4010 taken, `npm run test:e2e` fails within seconds with a port-in-use error
