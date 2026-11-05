// Runbook bookings.cancel-booking (docs/runbooks/bookings/cancel-booking.md). Change the runbook first, then /runbooks:to-test bookings.cancel-booking.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

describe('Cancel a booking, freeing its interval while its id stays taken', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  const R1 = { id: 'R1', name: 'Agora Room' };

  const create = (body: Record<string, unknown>) =>
    fetch(`${baseUrl}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  // Sends POST /bookings/{id}/cancel with no body.
  const cancel = (id: string) =>
    fetch(`${baseUrl}/bookings/${id}/cancel`, { method: 'POST' });

  // Creates a "Given" booking through POST /bookings; each must return 201.
  const given = async (
    id: string,
    resource: string,
    start: number,
    end: number,
  ) => {
    const response = await create({ id, resource, start, end });
    expect(response.status, `given ${id}`).toBe(201);
  };

  // "A canceled" in the Given: the cancel must return 200.
  const givenCanceled = async (id: string) => {
    const response = await cancel(id);
    expect(response.status, `given ${id} canceled`).toBe(200);
  };

  const listBookings = async () => {
    const response = await fetch(`${baseUrl}/bookings`);
    expect(response.status, 'GET /bookings').toBe(200);
    return response.json();
  };

  const expectError = async (
    response: Response,
    status: number,
    error: string,
  ) => {
    expect(response.status).toBe(status);
    expect(await response.json()).toStrictEqual({
      error,
      message: expect.any(String),
    });
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

  it('S01 Canceling an active booking returns it canceled and keeps the row', async () => {
    await given('A', 'R1', 10, 20);

    const response = await cancel('A');

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      result: 'canceled',
      booking: { id: 'A', resource: R1, start: 10, end: 20, status: 'canceled' },
    });
    expect(await listBookings()).toStrictEqual([
      { id: 'A', resource: R1, start: 10, end: 20, status: 'canceled' },
    ]);
  });

  it('S02 Canceling a canceled booking returns already_canceled and changes nothing', async () => {
    await given('A', 'R1', 10, 20);
    await givenCanceled('A');
    const before = await listBookings();

    const response = await cancel('A');

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      result: 'already_canceled',
      booking: { id: 'A', resource: R1, start: 10, end: 20, status: 'canceled' },
    });
    expect(await listBookings()).toStrictEqual(before);
  });

  it('S03 An id no booking has returns not_found', async () => {
    const response = await cancel('Z');

    await expectError(response, 404, 'not_found');
  });

  it('S04 Ids are case-sensitive: `a` does not cancel `A`', async () => {
    await given('A', 'R1', 10, 20);

    const response = await cancel('a');

    await expectError(response, 404, 'not_found');
    expect(await listBookings()).toStrictEqual([
      { id: 'A', resource: R1, start: 10, end: 20, status: 'active' },
    ]);
  });

  it('S05 A canceled booking no longer conflicts', async () => {
    await given('A', 'R1', 10, 20);
    await givenCanceled('A');

    const response = await create({ id: 'C', resource: 'R1', start: 10, end: 20 });

    expect(response.status).toBe(201);
    expect(await response.json()).toStrictEqual({
      id: 'C',
      resource: R1,
      start: 10,
      end: 20,
      status: 'active',
    });
  });

  it("S06 A canceled booking's id stays taken", async () => {
    await given('A', 'R1', 10, 20);
    await givenCanceled('A');

    const response = await create({ id: 'A', resource: 'R1', start: 30, end: 40 });

    await expectError(response, 409, 'id_taken');
  });
});
