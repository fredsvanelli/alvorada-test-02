// Runbook bookings.check-availability (docs/runbooks/bookings/check-availability.md). Change the runbook first, then /runbooks:to-test bookings.check-availability.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

describe('Check whether an interval is free on a resource, without booking it', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  // Sends GET /availability with the query string exactly as written.
  const check = (query: string) => fetch(`${baseUrl}/availability?${query}`);

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

  const expectAnswer = async (
    response: Response,
    available: boolean,
    conflicts: string[],
  ) => {
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ available, conflicts });
  };

  const expectError = async (
    response: Response,
    status: number,
    error: string,
    label?: string,
  ) => {
    expect(response.status, label).toBe(status);
    const body = await response.json();
    expect(body, label).toMatchObject({ error, message: expect.any(String) });
    expect(body, label).not.toHaveProperty('conflicts');
    expect(body, label).not.toHaveProperty('available');
  };

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

  it('S01 An interval that overlaps active bookings is not available, and lists them in ascending id order', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await check('resource=R1&start=19&end=21');

    await expectAnswer(response, false, ['A', 'B']);
  });

  it('S02 An interval that starts where the last booking ends is available', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await check('resource=R1&start=30&end=40');

    await expectAnswer(response, true, []);
  });

  it('S03 Bookings of another resource never conflict', async () => {
    await given('A', 'R1', 10, 20);

    const response = await check('resource=R2&start=10&end=20');

    await expectAnswer(response, true, []);
  });

  it('S04 Conflicting ids are ordered by character code', async () => {
    await given('B', 'R1', 0, 1);
    await given('a', 'R1', 1, 2);
    await given('10', 'R1', 2, 3);
    await given('9', 'R1', 3, 4);

    const response = await check('resource=R1&start=0&end=5');

    await expectAnswer(response, false, ['10', '9', 'B', 'a']);
  });

  it('S05 Each invalid query returns invalid_data', async () => {
    const queries: Record<string, string> = {
      'start not a number': 'resource=R1&start=abc&end=20',
      'start after end': 'resource=R1&start=20&end=10',
      'missing resource': 'start=10&end=20',
      'repeated resource': 'resource=R1&resource=R2&start=10&end=20',
    };

    for (const [name, query] of Object.entries(queries)) {
      await expectError(await check(query), 422, 'invalid_data', name);
    }
  });

  it('S06 An unknown resource returns unknown_resource', async () => {
    const response = await check('resource=R9&start=10&end=20');

    await expectError(response, 404, 'unknown_resource');
  });
});
