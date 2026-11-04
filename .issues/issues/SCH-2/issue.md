---
id: SCH-2
title: Implement the Case 02 conflict-free bookings app
type: feature
status: backlog
priority: high
created: 2026-11-04T20:00:32.257Z
updated: 2026-11-04T20:00:32Z
---

## Description

### Context

Implement Case 02 (conflict-free bookings) as described in the PRD (`.issues/docs/PRD.md`), following the architecture in `docs/diagrams/architecture.md` (SCH-1).

Stack: Next.js (TypeScript) with Tailwind and shadcn/ui, Nest.js REST API, Postgres 16 in Docker.

### Scope (in)

- Fixed, seeded list of resources (R1, R2)
- Create a booking (`id`, `resource`, `start`, `end`) with the `[start, end)` rule against active bookings of the same resource
- Rejections: `invalid_data`, `unknown_resource`, `id_taken`, `conflict`; a rejected attempt does not take the id
- Check availability without writing, with conflicts in ascending id order
- Cancel (`already_canceled`, `not_found`); a canceled id stays taken
- List bookings with active or canceled status
- Web UI over the API, tests and README

### Out of scope

- Payment, recurring bookings, authentication, concurrent access (excluded by the PRD)
- Deployment or cloud infrastructure
- The walkthrough video

## Acceptance criteria

- [ ] A booking from 10 to 20 frees the resource at 20, so another booking on the same resource can start at 20
- [ ] Overlap only counts active bookings of the same resource
- [ ] Unknown resource, invalid data and taken slots are rejected with a reason, and a rejected attempt does not take the id
- [ ] A created booking id is never reused, even after cancellation
- [ ] Availability for a valid resource and interval reports whether it is free and the conflicting active bookings in ascending id order, without changing data
- [ ] Cancel frees the slot, returns `already_canceled` without changes when repeated, and reports `not_found` for an unknown id
- [ ] Bookings can be listed with their active or canceled status
- [ ] The PRD example (A, B, C on R1 and R2) runs as an automated test
- [ ] The README explains install, run, tests, a reproducible demo, three highlighted tests, two decisions, AI use, time spent and what is left
