import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, type BookingStatus, type BookingView } from './booking.entity.js';

// A raw row of the JOIN; pg returns integer columns as numbers.
type ViewRow = {
  id: string;
  start_time: number;
  end_time: number;
  status: BookingStatus;
  resource_id: string;
  resource_name: string;
};

@Injectable()
export class BookingsRepository {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {}

  findById(id: string): Promise<Booking | null> {
    return this.bookings.findOneBy({ id });
  }

  // Ascending id order by character code: the database's en_US collation
  // would put "a" before "B". This is the one place that order is defined.
  findActiveByResource(resource: string): Promise<Booking[]> {
    return this.bookings
      .createQueryBuilder('booking')
      .where('booking.resource_id = :resource', { resource })
      .andWhere("booking.status = 'active'")
      .orderBy('booking.id COLLATE "C"')
      .getMany();
  }

  findAllWithResource(): Promise<BookingView[]> {
    return this.findViews('', []);
  }

  async findByIdWithResource(id: string): Promise<BookingView | null> {
    const [view] = await this.findViews('WHERE b.id = $1', [id]);
    return view ?? null;
  }

  // Bookings with their resource in one JOIN, ascending id by character code.
  // The resource_id foreign key means the inner join never drops a booking.
  private async findViews(
    where: string,
    params: unknown[],
  ): Promise<BookingView[]> {
    const rows: ViewRow[] = await this.bookings.query(
      `SELECT b.id, b.start_time, b.end_time, b.status,
              r.id AS resource_id, r.name AS resource_name
       FROM booking b JOIN resource r ON r.id = b.resource_id
       ${where}
       ORDER BY b.id COLLATE "C"`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      resource: { id: row.resource_id, name: row.resource_name },
      start: row.start_time,
      end: row.end_time,
      status: row.status,
    }));
  }

  // insert, not save: save would update a row that already has this id.
  async insert(booking: Booking): Promise<void> {
    await this.bookings.insert(booking);
  }
}
