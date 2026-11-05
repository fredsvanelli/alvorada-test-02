---
id: SCH-8
title: Cancel and list bookings with POST /bookings/:id/cancel and GET /bookings
type: feature
status: in_progress
estimate: 3
assignee: fred-vanelli
parent: SCH-2
blocked_by: [SCH-4]
branch: sch-8-cancel-and-list-bookings-with-post
created: 2026-11-04T20:00:44.671Z
updated: 2026-11-05T03:08:12Z
---

## Acceptance criteria

- [ ] `POST /bookings/:id/cancel` on an active booking returns 200 and sets its status to `canceled`, keeping the row
- [ ] Canceling an already canceled booking returns 200 `already_canceled` and changes nothing
- [ ] Canceling an unknown id returns 404 `not_found`
- [ ] A canceled booking no longer counts as active, so it stops causing conflicts
- [ ] `GET /bookings` returns every booking, active and canceled, with its status, in ascending id order
- [ ] Unit tests cover the service and the controller, and test, lint, typecheck and build pass

## Description

### Context

Sixth step of SCH-2, blocked only by SCH-4 (the `booking` table). It builds the cancel flow from section 4.3 of `docs/diagrams/architecture.md` and the list of bookings the PRD asks for.

Cancel never deletes a row: it sets `status = canceled`, so the slot frees up while the primary key keeps the id taken. Whichever of SCH-6, SCH-7 and SCH-8 starts first creates `BookingsModule`, the `Booking` entity and `BookingsRepository`.

### Scope (in)

- `POST /bookings/:id/cancel`: 200 with the canceled booking for an active one, 200 `already_canceled` with no change for a canceled one, 404 `not_found` for an unknown id
- `GET /bookings`: every booking, active and canceled, with its status, ordered by id
- `BookingsRepository`: find by id, set status, list all
- Unit tests for the service and the controller

### Out of scope

- Deleting a booking, or reactivating a canceled one
- Paging the list: the data set is small
- How canceling frees the slot for create and availability: that follows from their "active only" query and is checked end to end in SCH-9
- The cancel button and the list in the web app (SCH-10)

### Open questions for the design step

- What does the `already_canceled` response look like: the booking plus a flag, or only the code? The PRD treats it as a result, not an error
- Does `GET /bookings` take a `resource` or `status` filter, or does the UI filter on the client?
- Does the error body match the one SCH-6 chooses?
