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

  // Sends POST /bookings and returns the response; the caller asserts it.
  const createBooking = (
    id: string,
    resource: string,
    start: number,
    end: number,
  ) =>
    fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resource, start, end }),
    });

  // Creates a "Given" booking through POST /bookings; each must return 201.
  const given = async (
    id: string,
    resource: string,
    start: number,
    end: number,
  ) => {
    const response = await createBooking(id, resource, start, end);
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
      'end above the bookable window': 'resource=R1&start=0&end=101',
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

  it('S07 A check writes nothing', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);
    const before = await fetch(`${baseUrl}/bookings`);
    expect(before.status, 'GET /bookings before').toBe(200);
    const beforeBody: unknown = await before.json();

    const response = await check('resource=R1&start=19&end=21');

    expect(response.status).toBe(200);
    const after = await fetch(`${baseUrl}/bookings`);
    expect(after.status, 'GET /bookings after').toBe(200);
    expect(await after.json()).toStrictEqual(beforeBody);
  });

  it('S08 A canceled booking no longer conflicts', async () => {
    await given('A', 'R1', 10, 20);
    const cancel = await fetch(`${baseUrl}/bookings/A/cancel`, {
      method: 'POST',
    });
    expect(cancel.status, 'cancel A').toBe(200);

    const response = await check('resource=R1&start=10&end=20');

    await expectAnswer(response, true, []);
  });

  it('S09 An id that an active booking has returns id_taken, before the conflict lookup', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await check('resource=R1&start=19&end=21&id=A');

    await expectError(response, 409, 'id_taken');
  });

  it('S10 An id that a canceled booking has still returns id_taken', async () => {
    await given('A', 'R1', 10, 20);
    const cancel = await fetch(`${baseUrl}/bookings/A/cancel`, {
      method: 'POST',
    });
    expect(cancel.status, 'cancel A').toBe(200);

    const response = await check('resource=R1&start=10&end=20&id=A');

    await expectError(response, 409, 'id_taken');
  });

  it('S11 A free id answers exactly as a check without id', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await check('resource=R1&start=19&end=21&id=C');

    await expectAnswer(response, false, ['A', 'B']);
  });

  it('S12 An unknown resource wins over a taken id', async () => {
    await given('A', 'R1', 10, 20);

    const response = await check('resource=R9&start=10&end=20&id=A');

    await expectError(response, 404, 'unknown_resource');
  });

  it('S13 An empty, repeated or malformed id returns invalid_data', async () => {
    const queries: Record<string, string> = {
      'empty id': 'resource=R1&start=10&end=20&id=',
      'repeated id': 'resource=R1&start=10&end=20&id=C&id=D',
      'id with a space': 'resource=R1&start=10&end=20&id=C%20D',
      'id over 64 characters': `resource=R1&start=10&end=20&id=${'x'.repeat(65)}`,
    };

    for (const [name, query] of Object.entries(queries)) {
      await expectError(await check(query), 422, 'invalid_data', name);
    }
  });

  it('S14 An available check claims nothing, so the same interval and id can be booked right after', async () => {
    const response = await check('resource=R1&start=10&end=20&id=X');

    await expectAnswer(response, true, []);
    const create = await createBooking('X', 'R1', 10, 20);
    expect(create.status, 'POST /bookings after').toBe(201);
  });

  it('S15 Times at both ends of the bookable window are accepted', async () => {
    const response = await check('resource=R1&start=0&end=100');

    await expectAnswer(response, true, []);
  });
});
