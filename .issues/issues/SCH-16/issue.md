---
id: SCH-16
title: "Cap API booking times to the [0, 100) window"
type: feature
status: in_review
priority: medium
estimate: 3
assignee: fred-vanelli
related: [SCH-17, SCH-18]
branch: sch-16-cap-api-booking-times-to-the-0-100
created: 2026-11-06T01:11:31.832Z
updated: 2026-11-06T02:17:48Z
---

## Description

### Context

The API accepts booking times up to 2147483647, the limit of the Postgres `integer` columns, while the web form only offers 0 to 100. A direct API call can create a booking the form could never create, and the Timeline then stretches its axis to fit it. A cap in the API gives API callers and form users the same rule.

### Scope (in)

- The bookable window is `[0, 100)`, half-open like a booking: `start` goes from 0 to 99 and `end` from 1 to 100, with `start` before `end`.
- A time outside the window is `invalid_data` (422) when creating a booking and when checking availability.
- The `invalid_data` messages, the API contract, the tests, the runbooks, their fixtures and the project docs state the new range.
- The home page runbook creates its data inside the window, because its recording steps call the real API. Its step on the axis stretching past 100 uses a hand-written fixture.

### Out of scope

- Changing the Postgres columns or adding a database constraint.
- Bookings already stored with a time above 100. They still list, cancel and count for overlap.
- Removing the Timeline axis stretch past 100, which still applies to those stored bookings.
- Changing the web form, which already limits times to 100.

### Tasks

- [ ] Limit booking times to the window when creating a booking and when checking availability
- [ ] State the new range in the validation messages and the API contract
- [ ] Cover the limits in the tests: 0, 99, 100 and 101
- [ ] Update the runbooks and fixtures of the create, availability, form, preview and home page flows
- [ ] Update the README and the design docs
- [ ] Run the affected runbooks

## Acceptance criteria

- [ ] `POST /bookings` with `start` 0 and `end` 100 answers 201.
- [ ] `POST /bookings` with `end` 101 answers 422 `invalid_data`, and `GET /bookings` shows no new row.
- [ ] `GET /availability` with `start=0&end=100` answers 200, and with `end=101` answers 422 `invalid_data`.
- [ ] The `invalid_data` messages of both endpoints say that times go from 0 to 100.
- [ ] The API contract gives 100 as the maximum time, and `npx @redocly/cli lint api/openapi.yaml` passes.
- [ ] The README, `CLAUDE.md` and the architecture document give 0 to 100 as the valid range.
- [ ] No runbook creates a booking past 100 through the API.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and `npm run test:e2e` pass.
- [ ] `/runbooks:run --affected` reports no failure.
