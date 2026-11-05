// Runbook bookings.list-bookings (docs/runbooks/bookings/list-bookings.md). Change the runbook first, then /runbooks:to-test bookings.list-bookings.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

describe('List every booking with its status and resource, in ascending id order', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  // Sends GET /bookings exactly as written: no query and no body.
  const list = () => fetch(`${baseUrl}/bookings`);

  // Creates a "Given" booking through POST /bookings; each must return 201.
  const given = async (
    id: string,
    resource: string,
    start: number,
    end: number,
  ) => {
    const response = await fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resource, start, end }),
    });
    expect(response.status, `given ${id}`).toBe(201);
  };

  const R1 = { id: 'R1', name: 'Agora Room' };
  const R2 = { id: 'R2', name: 'Pixel Room' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM booking');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('S01 An empty booking table lists no bookings', async () => {
    const response = await list();

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toStrictEqual([]);
  });

  it('S02 Each booking is listed with its nested resource, status and numeric interval', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R2', 10, 20);

    const response = await list();

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([
      { id: 'A', resource: R1, start: 10, end: 20, status: 'active' },
      { id: 'B', resource: R2, start: 10, end: 20, status: 'active' },
    ]);
  });

  it('S03 Bookings are ordered by id, by character code', async () => {
    await given('B', 'R1', 0, 1);
    await given('a', 'R1', 1, 2);
    await given('10', 'R1', 2, 3);
    await given('9', 'R1', 3, 4);

    const response = await list();

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([
      { id: '10', resource: R1, start: 2, end: 3, status: 'active' },
      { id: '9', resource: R1, start: 3, end: 4, status: 'active' },
      { id: 'B', resource: R1, start: 0, end: 1, status: 'active' },
      { id: 'a', resource: R1, start: 1, end: 2, status: 'active' },
    ]);
  });
});
