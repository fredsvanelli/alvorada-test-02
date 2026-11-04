import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('resource')
export class Resource {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  name: string;
}
