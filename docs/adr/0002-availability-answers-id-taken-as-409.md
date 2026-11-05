# The availability check answers a taken id with 409 id_taken

`GET /availability` takes an optional `id`, so a client learns that an id is already used before it posts the booking. When the id is taken (by an Active or Canceled Booking), the check answers `409 { error: "id_taken" }`, the same error and status as a create, and checks in the create's order: `invalid_data`, `unknown_resource`, `id_taken`, then the Conflicts. Without `id`, the answer is unchanged.

## Considered Options

- A 200 with an `idTaken` field next to `available` and `conflicts`: shows the taken id and the Conflicts together, and keeps a read-only check from answering 409. Rejected so the check gives the same answer, in the same order, as the create it predicts.

## Consequences

- With a taken id, the answer lists no Conflicts. A client that wants them checks again without `id`.
