# Conflict-free bookings

A team shares a fixed list of resources and books them for intervals of time, with no two active bookings of the same resource overlapping.

## Language

**Resource**:
A bookable thing from the fixed list (R1 to R5), identified by its id and shown by its name.
_Avoid_: room, equipment

**Booking**:
A claim on one Resource for one Interval, identified by an id the client chooses. Its id is never reused once created.
_Avoid_: reservation

**Interval**:
A half-open span `[start, end)` of integer times with start before end; the Resource is free again at `end`.
_Avoid_: period, slot, range

**Active** / **Canceled**:
The two statuses of a Booking. A Canceled Booking keeps its id but no longer occupies its Interval.
_Avoid_: deleted, freed

**Conflict**:
An Active Booking of the same Resource whose Interval overlaps the one being asked about.
_Avoid_: clash, collision

**Rejection**:
A create attempt that is refused with a reason and writes nothing, so its id stays free.
_Avoid_: failed booking

**Availability check**:
A read-only question of whether an Interval on a Resource has any Conflicts, answered with the Conflicts in ascending id order.
_Avoid_: query, lookup
