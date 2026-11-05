# Booking responses nest the resource; requests send its id

Every response that returns a Booking (`GET /bookings`, the 201 of `POST /bookings`, and `POST /bookings/:id/cancel`) gives `resource` as `{ id, name }`, so the web app shows the resource's name without a second lookup. Requests still identify a resource by its id (`"resource": "R1"` in the create body, `?resource=R1` on `/availability`), so the same field is a string going in and an object coming out. All booking responses share this one shape, so clients need only one Booking type.

## Considered Options

- A flat `resourceName` next to `resource: "R1"`: keeps request and response symmetric, rejected in favor of grouping the resource's id and name in one object.
- Name only on `GET /bookings`: rejected because create and cancel would then return a different Booking shape from the list.
