import { Injectable } from '@nestjs/common';
import { ResourcesService } from '../resources/resources.service.js';
import { Booking } from './booking.entity.js';
import { type Interval, overlaps, parseInterval } from './booking-rules.js';
import { BookingsRepository } from './bookings.repository.js';

export type CreateError =
  'invalid_data' | 'unknown_resource' | 'id_taken' | 'conflict';

export type CreateResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: Exclude<CreateError, 'conflict'> }
  | { ok: false; error: 'conflict'; conflicts: string[] };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

// A resource id to look up: a non-empty string. Arrays (a repeated query
// param) and NUL fail. Postgres text cannot hold NUL: it would throw a 500
// instead of invalid_data.
function isResourceId(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !value.includes('\u0000');
}

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
    !isResourceId(resource) ||
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
    const conflicts = await this.findConflicts(booking.resource, booking);
    if (conflicts.length > 0)
      return { ok: false, error: 'conflict', conflicts };
    // ponytail: check-then-insert is not atomic; concurrency is out of scope (PRD).
    await this.bookings.insert(booking);
    return { ok: true, booking };
  }

  // The one conflict lookup, shared by create and availability so they cannot
  // disagree. Ids keep the repository's ascending id order.
  private async findConflicts(
    resource: string,
    interval: Interval,
  ): Promise<string[]> {
    const active = await this.bookings.findActiveByResource(resource);
    return active
      .filter((other) => overlaps(interval, other))
      .map((other) => other.id);
  }
}
