import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './booking.entity.js';

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

  // insert, not save: save would update a row that already has this id.
  async insert(booking: Booking): Promise<void> {
    await this.bookings.insert(booking);
  }
}
