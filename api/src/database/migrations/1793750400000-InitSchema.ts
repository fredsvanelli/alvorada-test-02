import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1793750400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE resource (
        id   text PRIMARY KEY,
        name text NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE booking (
        id          text    PRIMARY KEY,
        resource_id text    NOT NULL REFERENCES resource (id),
        start_time  integer NOT NULL,
        end_time    integer NOT NULL,
        status      text    NOT NULL DEFAULT 'active',
        CONSTRAINT booking_interval_check CHECK (start_time < end_time),
        CONSTRAINT booking_status_check CHECK (status IN ('active', 'canceled'))
      )
    `);
    await queryRunner.query(`
      INSERT INTO resource (id, name) VALUES
        ('R1', 'Agora Room'),
        ('R2', 'Pixel Room'),
        ('R3', '4K Projector'),
        ('R4', 'Orbit Room'),
        ('R5', 'Focus Room')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE booking');
    await queryRunner.query('DROP TABLE resource');
  }
}
