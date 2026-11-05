import { Column, Entity, PrimaryColumn } from 'typeorm';

export type BookingStatus = 'active' | 'canceled';

// The stored row. Properties use the API names; responses use BookingView.
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

// A booking as every response returns it: the resource nested with its name
// (docs/adr/0001-nested-resource-in-booking-responses.md).
export type BookingView = {
  id: string;
  resource: { id: string; name: string };
  start: number;
  end: number;
  status: BookingStatus;
};
