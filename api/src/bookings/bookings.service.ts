import { Injectable } from '@nestjs/common';
import { ResourcesService } from '../resources/resources.service.js';
import { Booking } from './booking.entity.js';
import { overlaps, parseInterval } from './booking-rules.js';
import { BookingsRepository } from './bookings.repository.js';

export type CreateError =
  'invalid_data' | 'unknown_resource' | 'id_taken' | 'conflict';

export type CreateResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: Exclude<CreateError, 'conflict'> }
  | { ok: false; error: 'conflict'; conflicts: string[] };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// Returns the booking to insert, or null when the body is invalid_data.
function parseBooking(body: unknown): Booking | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }
  const { id, resource, start, end } = body as Record<string, unknown>;
  const interval = parseInterval(start, end);
  if (
    typeof id !== 'string' ||
    !ID.test(id) ||
    typeof resource !== 'string' ||
    resource === '' ||
    interval === null
  ) {
    return null;
  }
  return { id, resource, ...interval, status: 'active' };
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly resources: ResourcesService,
  ) {}

  // Checks run in the order invalid_data, unknown_resource, id_taken,
  // conflict. Every check runs before the insert, so a rejection writes nothing.
  async create(body: unknown): Promise<CreateResult> {
    const booking = parseBooking(body);
    if (!booking) return { ok: false, error: 'invalid_data' };
    if (!(await this.resources.exists(booking.resource))) {
      return { ok: false, error: 'unknown_resource' };
    }
    if (await this.bookings.findById(booking.id)) {
      return { ok: false, error: 'id_taken' };
    }
    const active = await this.bookings.findActiveByResource(booking.resource);
    const conflicts = active
      .filter((other) => overlaps(booking, other))
      .map((other) => other.id);
    if (conflicts.length > 0)
      return { ok: false, error: 'conflict', conflicts };
    // ponytail: check-then-insert is not atomic; concurrency is out of scope (PRD).
    await this.bookings.insert(booking);
    return { ok: true, booking };
  }
}
