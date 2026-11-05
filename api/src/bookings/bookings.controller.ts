import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
} from '@nestjs/common';
import { Booking } from './booking.entity.js';
import {
  AvailabilityError,
  BookingsService,
  CreateError,
} from './bookings.service.js';

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

// Availability takes no id, so its invalid_data message does not ask for one.
const AVAILABILITY_MESSAGE: Record<AvailabilityError, string> = {
  invalid_data:
    'Send resource, and integer start and end from 0 to 2147483647 with start before end.',
  unknown_resource: MESSAGE.unknown_resource,
};

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Maps the service result to HTTP: 201 with the booking, or the error body.
  @Post('bookings')
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

  // Read-only: 200 with available and conflicts, or the error body. The raw
  // query values go to the service, which validates them.
  @Get('availability')
  async availability(
    @Query('resource') resource: unknown,
    @Query('start') start: unknown,
    @Query('end') end: unknown,
  ): Promise<{ available: boolean; conflicts: string[] }> {
    const result = await this.bookings.availability(resource, start, end);
    if (result.ok) {
      return { available: result.available, conflicts: result.conflicts };
    }
    throw new HttpException(
      { error: result.error, message: AVAILABILITY_MESSAGE[result.error] },
      STATUS[result.error],
    );
  }
}
