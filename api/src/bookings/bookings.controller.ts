import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { BookingView } from './booking.entity.js';
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

// Availability's id is optional, so its invalid_data message says so.
const AVAILABILITY_MESSAGE: Record<AvailabilityError, string> = {
  invalid_data:
    'Send resource, integer start and end from 0 to 2147483647 with start before end, and optionally an id (1 to 64 letters, digits, - or _).',
  unknown_resource: MESSAGE.unknown_resource,
  id_taken: MESSAGE.id_taken,
};

@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Maps the service result to HTTP: 201 with the booking, or the error body.
  @Post('bookings')
  async create(@Body() body: unknown): Promise<BookingView> {
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

  // 200 for both outcomes (Nest answers POST with 201 by default), or 404.
  @Post('bookings/:id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string): Promise<{
    result: 'canceled' | 'already_canceled';
    booking: BookingView;
  }> {
    const result = await this.bookings.cancel(id);
    if (result.ok) return { result: result.result, booking: result.booking };
    throw new HttpException(
      { error: result.error, message: 'No booking has this id.' },
      404,
    );
  }

  @Get('bookings')
  list(): Promise<BookingView[]> {
    return this.bookings.list();
  }

  // Read-only: 200 with available and conflicts, or the error body. The raw
  // query values go to the service, which validates them.
  @Get('availability')
  async availability(
    @Query('resource') resource: unknown,
    @Query('start') start: unknown,
    @Query('end') end: unknown,
    @Query('id') id?: unknown,
  ): Promise<{ available: boolean; conflicts: string[] }> {
    const result = await this.bookings.availability(resource, start, end, id);
    if (result.ok) {
      return { available: result.available, conflicts: result.conflicts };
    }
    throw new HttpException(
      { error: result.error, message: AVAILABILITY_MESSAGE[result.error] },
      STATUS[result.error],
    );
  }
}
