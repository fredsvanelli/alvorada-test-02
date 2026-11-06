# Conflict-free bookings

A team shares a fixed list of resources and books them for intervals of time, with no two active bookings of the same resource overlapping.

## Language

**Resource**:
A bookable thing from the fixed list (R1 to R5), identified by its id and shown by its name.
_Avoid_: room, equipment

**Booking**:
A claim on one Resource for one Interval, identified by an id the client chooses. Its id is never reused once created. An id is 1 to 64 letters, digits, `-` or `_`, and case matters: `a` and `A` are different Bookings.
_Avoid_: reservation

**Interval**:
A half-open span `[start, end)` of non-negative integer times with start before end; the Resource is free again at `end`.
_Avoid_: period, slot, range

**Bookable window**:
The times `[0, 100)` that a new Booking or an Availability check may ask about. A Booking stored before the window existed may lie outside it. It still lists, can be Canceled and counts for Conflicts.
_Avoid_: range, cap, limit

**Active** / **Canceled**:
The two statuses of a Booking. A Canceled Booking keeps its id but no longer occupies its Interval.
_Avoid_: deleted, freed

**Cancel**:
To turn an Active Booking into a Canceled one, which frees its Interval and keeps its id taken. Canceling a Canceled Booking changes nothing and is answered **already canceled**. There is no way back from Canceled to Active.
_Avoid_: delete, remove, release

**Conflict**:
An Active Booking of the same Resource whose Interval overlaps the one being asked about.
_Avoid_: clash, collision

**Rejection**:
A create attempt that is refused with a reason and writes nothing, so its id stays free.
_Avoid_: failed booking

**Ascending id order**:
Ids compared character by character by character code, so `10` comes before `9` and `B` before `a`. Every list of Conflicts and every list of Bookings uses it.
_Avoid_: alphabetical order, natural order

**Availability check**:
A read-only question of whether an Interval on a Resource has any Conflicts, and optionally whether a Booking id is still free. The answer is **id taken** when the id was given and is already used, before any Conflict is looked at; otherwise it is **available** when there are no Conflicts, and lists the Conflicts in ascending id order when there are. The check claims nothing: an available Interval or a free id can still be taken by the next create.
_Avoid_: query, lookup, slot check

**Id taken**:
The answer given when a Booking id is already used by a Booking, Active or Canceled. Both a create and an Availability check that names the id give it.
_Avoid_: duplicate id, id conflict
