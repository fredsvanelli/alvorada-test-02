import { Column, Entity, PrimaryColumn } from 'typeorm';

export type BookingStatus = 'active' | 'canceled';

// Properties use the API names, so a Booking is also the response body.
@Entity('booking')
export class Booking {
  @PrimaryColumn('text')
  id: string;

  @Column('text', { name: 'resource_id' })
  resource: string;

  @Column('integer', { name: 'start_time' })
  start: number;

  @Column('integer', { name: 'end_time' })
  end: number;

  @Column('text')
  status: BookingStatus;
}
