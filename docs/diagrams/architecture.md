# Architecture diagrams: conflict-free bookings

One shared picture of the bookings app before implementation. It covers how the pieces run locally, what is stored, where the booking rules live and how each operation ends. The rules come from the PRD in [`.issues/docs/PRD.md`](../../.issues/docs/PRD.md).

1. [Containers](#1-containers)
2. [Data model](#2-data-model)
3. [Backend modules](#3-backend-modules)
4. [Booking flows](#4-booking-flows)

## 1. Containers

Everything runs on the developer machine. Only Postgres runs in Docker.

```mermaid
flowchart LR
  user(["Team member"])

  subgraph host["Developer machine"]
    browser["Browser"]
    web["Next.js app<br/>TypeScript + Tailwind + shadcn/ui"]
    api["Nest.js REST API<br/>TypeScript"]

    subgraph docker["Docker · docker compose up -d db"]
      db[("Postgres 16<br/>localhost:5432")]
    end
  end

  user --> browser
  browser -->|"HTTP · pages and UI"| web
  web -->|"REST / JSON over HTTP"| api
  api -->|"SQL over TCP"| db
```

## 2. Data model

The resources are a fixed list, seeded at startup. A booking id is chosen by the client, as in the PRD example (A, B, C).

```mermaid
erDiagram
  RESOURCE ||--o{ BOOKING : "is booked by"

  RESOURCE {
    text id PK "fixed list, seeded: R1 to R5"
    text name
  }

  BOOKING {
    text id PK "chosen by the client, never reused"
    text resource_id FK "must exist in RESOURCE"
    int start_time "inclusive"
    int end_time "exclusive, CHECK start_time < end_time"
    text status "active or canceled"
  }
```

How the id rules follow from the model:

- **A canceled booking keeps its id.** Cancel only sets `status = canceled`. The row is never deleted, so the primary key keeps the id taken.
- **A rejected attempt does not take an id.** Every check runs before the `INSERT`. A rejection writes no row, so the same id can be used again (the PRD's second attempt at `C`).
- **Overlap only counts active bookings of the same resource.** Two bookings on different resources, or one canceled booking, never conflict.

The lifecycle of one booking id:

```mermaid
stateDiagram-v2
  direction LR
  [*] --> free
  free --> free : rejected attempt, no row written
  free --> active : accepted, row inserted
  active --> canceled : cancel
  canceled --> canceled : cancel again returns already_canceled
  note right of canceled
    The row stays, so the id is never reused
  end note
```

## 3. Backend modules

The `[start, end)` rule lives in one pure function, `overlaps()`, which `BookingsService` calls for both create and availability. The controllers only map HTTP to service calls and results to status codes.

```mermaid
flowchart TB
  app["AppModule"]

  subgraph resourcesMod["ResourcesModule"]
    rc["ResourcesController<br/>GET /resources"]
    rs["ResourcesService<br/>list() · exists(id)"]
  end

  subgraph bookingsMod["BookingsModule"]
    bc["BookingsController<br/>POST /bookings<br/>GET /bookings<br/>GET /availability<br/>POST /bookings/:id/cancel"]
    bs["BookingsService<br/>create · list · availability · cancel"]
    rules["booking-rules.ts · pure functions<br/>parseInterval: integers 0..2147483647 and start < end<br/>overlaps a, b: a.start < b.end AND b.start < a.end"]
    repo["BookingsRepository<br/>find by id · active by resource ordered by id<br/>insert · set status"]
  end

  subgraph dbMod["DatabaseModule"]
    conn["Postgres connection"]
  end

  app --> resourcesMod
  app --> bookingsMod
  app --> dbMod

  rc --> rs
  bc --> bs
  bs -->|"resource exists?"| rs
  bs -->|"validate and check conflicts"| rules
  bs --> repo
  repo --> conn
  rs --> conn

  classDef rule fill:#fde68a,stroke:#b45309,stroke-width:2px,color:#000
  class rules rule
```

## 4. Booking flows

Error codes: `unknown_resource`, `invalid_data`, `conflict`, `id_taken`, `already_canceled` and `not_found`. `id_taken` is the rejection that keeps an id taken after it was used once.

### 4.1 Create a booking

```mermaid
sequenceDiagram
  autonumber
  actor U as Team member
  participant W as Next.js
  participant C as BookingsController
  participant S as BookingsService
  participant DB as Postgres

  U->>W: Submit id, resource, start, end
  W->>C: POST /bookings
  C->>S: create(dto)

  alt Invalid data: missing field, not an integer in 0..2147483647, or start >= end
    S-->>C: invalid_data
    C-->>W: 422 invalid_data
  else Unknown resource
    S->>DB: Find resource by id
    DB-->>S: none
    S-->>C: unknown_resource
    C-->>W: 404 unknown_resource
  else Id already used, active or canceled
    S->>DB: Find booking by id
    DB-->>S: row found
    S-->>C: id_taken
    C-->>W: 409 id_taken
  else Overlaps an active booking of the same resource
    S->>DB: Active bookings of the resource, ordered by id
    DB-->>S: rows
    S->>S: overlaps(new, b) is true for some b
    S-->>C: conflict with the conflicting ids
    C-->>W: 409 conflict, conflicts A, B
  else Accepted
    S->>DB: Active bookings of the resource
    DB-->>S: rows
    S->>S: overlaps(new, b) is false for every b
    S->>DB: INSERT booking with status active
    S-->>C: booking
    C-->>W: 201 booking
  end

  Note over S,DB: A rejection writes nothing, so its id stays free
  W-->>U: Show the result or the reason
```

### 4.2 Check availability

The query never writes. Conflicts come back in ascending id order.

```mermaid
sequenceDiagram
  autonumber
  actor U as Team member
  participant W as Next.js
  participant C as BookingsController
  participant S as BookingsService
  participant DB as Postgres

  U->>W: Check R1 for [19, 21)
  W->>C: GET /availability?resource=R1&start=19&end=21
  C->>S: availability(resource, start, end)

  alt Invalid data: missing field, not an integer in 0..2147483647, or start >= end
    S-->>C: invalid_data
    C-->>W: 422 invalid_data
  else Unknown resource
    S->>DB: Find resource by id
    DB-->>S: none
    S-->>C: unknown_resource
    C-->>W: 404 unknown_resource
  else Valid query
    S->>DB: SELECT active bookings of R1 ORDER BY id ASC
    DB-->>S: rows
    S->>S: Keep the rows where overlaps(query, b) is true
    S-->>C: available = no conflicts, conflicts in ascending id
    C-->>W: 200 available false, conflicts A, B
  end

  Note over S,DB: Read only, nothing is written
  W-->>U: Show available or the conflicting bookings
```

### 4.3 Cancel a booking

```mermaid
sequenceDiagram
  autonumber
  actor U as Team member
  participant W as Next.js
  participant C as BookingsController
  participant S as BookingsService
  participant DB as Postgres

  U->>W: Cancel booking A
  W->>C: POST /bookings/A/cancel
  C->>S: cancel(id)
  S->>DB: Find booking by id
  DB-->>S: row or none

  alt Not found
    S-->>C: not_found
    C-->>W: 404 not_found
  else Already canceled
    S-->>C: already_canceled
    C-->>W: 200 already_canceled, nothing changes
  else Active
    S->>DB: UPDATE status to canceled, row kept
    S-->>C: canceled booking
    C-->>W: 200 canceled
  end

  Note over S,DB: The slot is free again, the id stays taken
  W-->>U: Show the result
```
