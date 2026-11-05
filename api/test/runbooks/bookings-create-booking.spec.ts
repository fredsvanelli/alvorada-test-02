// Runbook bookings.create-booking (docs/runbooks/bookings/create-booking.md). Change the runbook first, then /runbooks:to-test bookings.create-booking.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

describe('Create a booking, or reject it without writing anything', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  // Sends a raw body to POST /bookings with Content-Type: application/json.
  const postRaw = (raw: string) =>
    fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });

  const post = (body: unknown) => postRaw(JSON.stringify(body));

  // Creates a "Given" booking; each must return 201.
  const given = async (
    id: string,
    resource: string,
    start: number,
    end: number,
  ) => {
    const response = await post({ id, resource, start, end });
    expect(response.status).toBe(201);
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
  };

  const expectConflict = async (response: Response, conflicts: string[]) => {
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({
      error: 'conflict',
      message: expect.any(String),
    });
    expect(body.conflicts).toEqual(conflicts);
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

  it('S01 A client creates a booking on a free interval', async () => {
    const response = await post({
      id: 'A',
      resource: 'R1',
      start: 10,
      end: 20,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toStrictEqual({
      id: 'A',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 10,
      end: 20,
      status: 'active',
    });

    const readBack = await post({
      id: 'B',
      resource: 'R1',
      start: 15,
      end: 25,
    });
    await expectConflict(readBack, ['A']);
  });

  it('S02 Times sent as digit-only strings are stored and returned as numbers', async () => {
    const response = await post({
      id: 'A',
      resource: 'R1',
      start: '10',
      end: '20',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'A',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 10,
      end: 20,
      status: 'active',
    });

    const readBack = await post({
      id: 'B',
      resource: 'R1',
      start: 19,
      end: 21,
    });
    await expectConflict(readBack, ['A']);
  });

  it('S03 Each invalid body returns invalid_data and writes nothing', async () => {
    const bodies: Record<string, unknown> = {
      'missing end': { id: 'A', resource: 'R1', start: 10 },
      'negative start': { id: 'A', resource: 'R1', start: -1, end: 20 },
      'end above the integer range': {
        id: 'A',
        resource: 'R1',
        start: 10,
        end: 2147483648,
      },
      'empty interval': { id: 'A', resource: 'R1', start: 20, end: 20 },
      'id with a space': { id: 'a b', resource: 'R1', start: 10, end: 20 },
      '65-character id': {
        id: 'A'.repeat(65),
        resource: 'R1',
        start: 10,
        end: 20,
      },
      'resource not a string': { id: 'A', resource: 7, start: 10, end: 20 },
      'array body': [{ id: 'A', resource: 'R1', start: 10, end: 20 }],
    };

    for (const [name, body] of Object.entries(bodies)) {
      await expectError(await post(body), 422, 'invalid_data', name);
    }

    const readBack = await post({
      id: 'A',
      resource: 'R1',
      start: 10,
      end: 20,
    });
    expect(readBack.status).toBe(201);
  });

  it("S04 Malformed JSON and a top-level null get the JSON parser's 400", async () => {
    for (const raw of ['{', 'null']) {
      const response = await postRaw(raw);

      expect(response.status, raw).toBe(400);
      expect(await response.json(), raw).toMatchObject({
        statusCode: 400,
        message: expect.any(String),
      });
    }
  });

  it('S05 An unknown resource returns unknown_resource, matched exactly', async () => {
    for (const resource of ['R9', 'r1']) {
      const response = await post({ id: 'A', resource, start: 10, end: 20 });
      await expectError(response, 404, 'unknown_resource');
    }
  });

  it('S06 A used id returns id_taken, whatever the resource and interval', async () => {
    await given('A', 'R1', 10, 20);

    const response = await post({
      id: 'A',
      resource: 'R2',
      start: 50,
      end: 60,
    });

    await expectError(response, 409, 'id_taken');
  });

  it('S07 An interval that starts where another ends is accepted', async () => {
    await given('A', 'R1', 10, 20);

    const response = await post({
      id: 'B',
      resource: 'R1',
      start: 20,
      end: 30,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'B',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 20,
      end: 30,
      status: 'active',
    });
  });

  it('S08 An overlap returns conflict with every conflicting id in ascending order', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await post({
      id: 'C',
      resource: 'R1',
      start: 19,
      end: 21,
    });

    await expectConflict(response, ['A', 'B']);
  });

  it('S09 A rejected id stays free, and another resource never conflicts', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);
    const rejected = await post({
      id: 'C',
      resource: 'R1',
      start: 19,
      end: 21,
    });
    await expectConflict(rejected, ['A', 'B']);

    const response = await post({
      id: 'C',
      resource: 'R2',
      start: 19,
      end: 21,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'C',
      resource: { id: 'R2', name: 'Pixel Room' },
      start: 19,
      end: 21,
      status: 'active',
    });
  });

  it('S10 Ids are case-sensitive', async () => {
    await given('A', 'R1', 10, 20);

    const response = await post({
      id: 'a',
      resource: 'R1',
      start: 30,
      end: 40,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'a',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 30,
      end: 40,
      status: 'active',
    });
  });

  it('S11 Conflicting ids are ordered by character code', async () => {
    await given('B', 'R3', 0, 1);
    await given('a', 'R3', 1, 2);
    await given('10', 'R3', 2, 3);
    await given('9', 'R3', 3, 4);

    const response = await post({ id: 'X', resource: 'R3', start: 0, end: 4 });

    await expectConflict(response, ['10', '9', 'B', 'a']);
  });

  it('S12 The resource is checked before the id, and the id before the overlap', async () => {
    await given('A', 'R1', 10, 20);

    const first = await post({ id: 'A', resource: 'R9', start: 10, end: 20 });
    await expectError(first, 404, 'unknown_resource');

    const second = await post({ id: 'A', resource: 'R1', start: 10, end: 20 });
    await expectError(second, 409, 'id_taken');
  });

  it('S13 A request with no body returns invalid_data', async () => {
    const response = await fetch(`${baseUrl}/bookings`, { method: 'POST' });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'invalid_data',
      message: expect.any(String),
    });
  });

  it('S14 An empty resource is invalid_data, not unknown_resource', async () => {
    const response = await post({ id: 'A', resource: '', start: 10, end: 20 });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'invalid_data',
      message: expect.any(String),
    });
  });

  it('S15 Times at both ends of the integer range are accepted', async () => {
    const response = await post({
      id: 'A',
      resource: 'R1',
      start: 0,
      end: 2147483647,
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'A',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 0,
      end: 2147483647,
      status: 'active',
    });
  });

  it('S16 Times that are not non-negative integers or digit-only strings return invalid_data', async () => {
    const starts: Record<string, unknown> = {
      'fractional number': 10.5,
      'string in exponent notation': '1e1',
      'negative number as a string': '-5',
      boolean: true,
    };

    for (const [name, start] of Object.entries(starts)) {
      const response = await post({ id: 'A', resource: 'R1', start, end: 20 });

      expect(response.status, name).toBe(422);
      expect(await response.json(), name).toMatchObject({
        error: 'invalid_data',
        message: expect.any(String),
      });
    }
  });

  it('S17 Extra fields in the body are ignored, and a new booking is always active', async () => {
    const response = await post({
      id: 'A',
      resource: 'R1',
      start: 10,
      end: 20,
      status: 'canceled',
      note: 'x',
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toStrictEqual({
      id: 'A',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 10,
      end: 20,
      status: 'active',
    });

    const readBack = await post({
      id: 'B',
      resource: 'R1',
      start: 15,
      end: 25,
    });
    await expectConflict(readBack, ['A']);
  });

  it('S18 Invalid data is checked before the resource', async () => {
    const response = await post({
      id: 'a b',
      resource: 'R9',
      start: 10,
      end: 20,
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'invalid_data',
      message: expect.any(String),
    });
  });

  it('S19 conflicts lists only the bookings that overlap', async () => {
    await given('A', 'R1', 10, 20);
    await given('B', 'R1', 20, 30);

    const response = await post({
      id: 'C',
      resource: 'R1',
      start: 25,
      end: 35,
    });

    await expectConflict(response, ['B']);
  });

  it('S20 An interval that ends where another starts is accepted', async () => {
    await given('A', 'R1', 10, 20);

    const response = await post({ id: 'B', resource: 'R1', start: 0, end: 10 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'B',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 0,
      end: 10,
      status: 'active',
    });
  });
});
