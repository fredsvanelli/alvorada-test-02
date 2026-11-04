---
id: SCH-1
title: Create Mermaid architecture diagrams for the bookings app
type: task
status: backlog
priority: high
estimate: 3
assignee: fred-vanelli
created: 2026-11-04T18:19:59.444Z
updated: 2026-11-04T18:22:52Z
---

## Description

### Context

Before implementing Case 02 (conflict-free bookings), we need one shared picture of the whole system: how the Next.js frontend, the Nest.js API and Postgres fit together, what data is stored, and where the booking rules run. The picture guides the implementation and gets reused in the README and in the walkthrough video.

Stack: Next.js (TypeScript) with Tailwind and shadcn/ui as the component library, Nest.js backend, Postgres running locally in Docker.

### Scope (in)

- Containers view: browser → Next.js (shadcn/ui + Tailwind) → Nest.js REST API → Postgres (Docker), with how each one runs locally
- Data model (ER): resources (fixed list) and bookings (id, resource, start, end, status active/canceled)
- Backend modules view: Nest.js modules, controllers and services, and where the conflict rule `[start, end)` is enforced
- Booking flow sequences: create (accepted, rejected for unknown resource / invalid data / overlap), check availability with conflicts ordered by id, cancel (success, `ja_cancelada`, not found)
- Every diagram in Mermaid, in a Markdown doc in the repository, linked from the README
- Save the diagrams on /docs/diagrams

### Out of scope

- Implementing any part of the app
- Payment, recurring bookings, authentication and concurrent access (excluded by the PRD)
- Deployment or cloud infrastructure

### Tasks

- [ ] Draw the containers view of the local setup
- [ ] Draw the data model for resources and bookings
- [ ] Draw the backend modules and mark where the booking rules live
- [ ] Draw the sequences for create, check availability and cancel
- [ ] Publish the diagrams in the repository docs and link them from the README

## Acceptance criteria

- [ ] The diagrams doc renders on GitHub with all four views: containers, data model, backend modules and booking flows
- [ ] The containers view names Next.js with Tailwind and shadcn/ui, Nest.js and Postgres in Docker, and shows how they connect
- [ ] The data model shows that a booking id stays taken after cancellation and that a rejected attempt does not take an id
- [ ] The flow sequences cover every outcome in the PRD: accepted, rejected (unknown resource, invalid data, overlap), availability with conflicts by ascending id, canceled, ja_cancelada and not found
- [ ] The README links to the diagrams doc