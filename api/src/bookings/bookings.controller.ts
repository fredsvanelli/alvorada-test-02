import { Body, Controller, HttpException, Post } from '@nestjs/common';
import { Booking } from './booking.entity.js';
import { BookingsService, CreateError } from './bookings.service.js';

const STATUS: Record<CreateError, number> = {
  invalid_data: 422,
  unknown_resource: 404,
  id_taken: 409,
  conflict: 409,
};

const MESSAGE: Record<CreateError, string> = {
  invalid_data:
    'Send id (1 to 64 letters, digits, - or _), resource, and integer start and end from 0 to 2147483647 with start before end.',
  unknown_resource: 'This resource does not exist.',
  id_taken: 'This id was already used by another booking.',
  conflict: 'The interval overlaps active bookings of this resource.',
};

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Maps the service result to HTTP: 201 with the booking, or the error body.
  @Post()
  async create(@Body() body: unknown): Promise<Booking> {
    const result = await this.bookings.create(body);
    if (result.ok) return result.booking;
    throw new HttpException(
      {
        error: result.error,
        message: MESSAGE[result.error],
        ...(result.error === 'conflict' && { conflicts: result.conflicts }),
      },
      STATUS[result.error],
    );
  }
}
