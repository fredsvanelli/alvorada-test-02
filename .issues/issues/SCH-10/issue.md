---
id: SCH-10
title: "Build the web UI to list, create, check and cancel bookings"
type: feature
status: done
estimate: 5
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-6, SCH-7, SCH-8]
branch: sch-10-build-the-web-ui-to-list-create-check
created: 2026-11-04T20:00:44.885Z
updated: 2026-11-05T17:53:08Z
---

## Acceptance criteria

- [ ] The page lists the resources and the bookings, showing which are active or canceled
- [ ] A form creates a booking and shows the result or the rejection reason (`invalid_data`, `unknown_resource`, `id_taken`, or `conflict` with the ids)
- [ ] Checking a period shows whether it is available, or the conflicting ids in ascending order, without creating a booking
- [ ] Canceling a booking updates the list, and canceling it again shows `already_canceled`
- [ ] The UI follows the colors, spacing and layout of `.design/prototype-html/Main.dc.html` with shadcn/ui and Tailwind
- [ ] Lint, typecheck and build pass

## Description

### Context

Eighth step of SCH-2, blocked by SCH-6, SCH-7 and SCH-8, so every endpoint exists. Today `web/src/app/page.tsx` is the SCH-3 placeholder (a title and one shadcn `Button`), and the web app has no way to reach the API: no base URL setting and no CORS on the API.

The design reference is `.design/prototype-html/Main.dc.html` (and `.design/prototype.pdf`): one page with a booking form, a timeline per resource, a bookings table and an operation log. Replicate its colors, spacing and layout with shadcn/ui and Tailwind; do not copy its markup or runtime.

### Scope (in)

- A way for the web app to call the API (a base URL env var with CORS on the API, or a Next.js rewrite), documented in `CLAUDE.md`
- One page, following the prototype:
  - A form with id, resource, start and end, and two actions: Book (`POST /bookings`) and Check (`GET /availability`)
  - A result message for each outcome: created, `invalid_data`, `unknown_resource`, `id_taken`, `conflict` with the ids, available, unavailable with the ids
  - A timeline per resource showing active and canceled bookings
  - A bookings table with id, resource, period and status, an active / canceled filter, and a Cancel action that shows canceled, `already_canceled` or `not_found`
- The resources from `GET /resources` (R1 to R5, name only)
- Lint, typecheck and build pass

### Out of scope

- The prototype's resources R6 to R10 and its type line ("Room · 8 seats"): SCH-4 seeded R1 to R5 with a name only
- The prototype's own result codes (`id_in_use`, `booking_not_found`, `already_cancelled`): the UI shows the API's codes
- Authentication, editing a booking, dark mode, mobile-specific layouts
- Browser e2e tests

### Open questions for the design step

- Is the operation log (each call and its response) in scope? It helps the demo and the video, but it is not in the PRD
- Is the live preview on the timeline (free or conflict while typing, calling availability) in scope, or only the explicit Check button?
- Server components with server actions, or a client component that calls the API with `fetch`?
- Does the UI need its own tests (for example a component test for the result messages), or do lint, typecheck and build plus a manual check in the browser suffice?
