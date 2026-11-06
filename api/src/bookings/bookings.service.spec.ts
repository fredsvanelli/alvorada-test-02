import { Test } from '@nestjs/testing';
import { ResourcesService } from '../resources/resources.service.js';
import type { Booking, BookingStatus } from './booking.entity.js';
import { BookingsRepository } from './bookings.repository.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  const findById = vi.fn();
  const findActiveByResource = vi.fn();
  const insert = vi.fn();
  const findAllWithResource = vi.fn();
  const findByIdWithResource = vi.fn();
  const setStatus = vi.fn();
  const exists = vi.fn();
  const findResource = vi.fn();
  let service: BookingsService;

  const valid = { id: 'A', resource: 'R1', start: 10, end: 20 };
  const agora = { id: 'R1', name: 'Agora Room' };

  const booking = (
    id: string,
    start: number,
    end: number,
    status: BookingStatus = 'active',
  ): Booking => ({ id, resource: 'R1', start, end, status });

  beforeEach(async () => {
    for (const fn of [
      findById,
      findActiveByResource,
      insert,
      findAllWithResource,
      findByIdWithResource,
      setStatus,
      exists,
      findResource,
    ]) {
      fn.mockReset();
    }
    exists.mockResolvedValue(true);
    findResource.mockResolvedValue(agora);
    findById.mockResolvedValue(null);
    findActiveByResource.mockResolvedValue([]);
    insert.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingsRepository,
          useValue: {
            findById,
            findActiveByResource,
            insert,
            findAllWithResource,
            findByIdWithResource,
            setStatus,
          },
        },
        {
          provide: ResourcesService,
          useValue: { exists, findById: findResource },
        },
      ],
    }).compile();
    service = moduleRef.get(BookingsService);
  });

  it('creates an active booking and returns it with its resource nested', async () => {
    await expect(service.create(valid)).resolves.toStrictEqual({
      ok: true,
      booking: { ...valid, resource: agora, status: 'active' },
    });
    expect(findResource).toHaveBeenCalledWith('R1');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ ...valid, status: 'active' });
  });

  it('converts digit-only times to numbers', async () => {
    const result = await service.create({ ...valid, start: '10', end: '20' });
    expect(result).toMatchObject({ ok: true, booking: { start: 10, end: 20 } });
  });

  it('accepts start 0', async () => {
    const result = await service.create({ ...valid, start: 0 });
    expect(result).toMatchObject({ ok: true, booking: { start: 0 } });
  });

  it('ignores extra fields and always inserts active', async () => {
    await service.create({ ...valid, status: 'canceled', foo: 1 });
    expect(insert.mock.calls[0][0]).toStrictEqual({
      id: 'A',
      resource: 'R1',
      start: 10,
      end: 20,
      status: 'active',
    });
  });

  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['an array body', []],
    ['a string body', 'A'],
    ['a missing id', { ...valid, id: undefined }],
    ['a numeric id', { ...valid, id: 7 }],
    ['an empty id', { ...valid, id: '' }],
    ['an id with a space', { ...valid, id: 'a b' }],
    ['an id with a slash', { ...valid, id: 'a/b' }],
    ['a 65-character id', { ...valid, id: 'x'.repeat(65) }],
    ['a missing resource', { ...valid, resource: undefined }],
    ['a numeric resource', { ...valid, resource: 7 }],
    ['an empty resource', { ...valid, resource: '' }],
    ['a resource with a NUL character', { ...valid, resource: 'R\u0000' }],
    ['a missing start', { ...valid, start: undefined }],
    ['a negative start', { ...valid, start: -1 }],
    ['an end above the bookable window', { ...valid, end: 101 }],
    ['an empty interval', { ...valid, start: 20, end: 20 }],
    ['a decimal start', { ...valid, start: 10.5 }],
  ])('rejects invalid data: %s', async (_, body) => {
    await expect(service.create(body)).resolves.toStrictEqual({
      ok: false,
      error: 'invalid_data',
    });
    expect(findResource).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('accepts a 64-character id', async () => {
    const result = await service.create({ ...valid, id: 'x'.repeat(64) });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown resource', async () => {
    findResource.mockResolvedValue(null);
    await expect(service.create(valid)).resolves.toStrictEqual({
      ok: false,
      error: 'unknown_resource',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('passes resource unchanged', async () => {
    findResource.mockResolvedValue(null);
    const result = await service.create({ ...valid, resource: ' R1' });
    expect(findResource).toHaveBeenCalledWith(' R1');
    expect(result).toStrictEqual({ ok: false, error: 'unknown_resource' });
  });

  it.each<BookingStatus>(['active', 'canceled'])(
    'rejects a taken id, %s',
    async (status) => {
      findById.mockResolvedValue(booking('A', 50, 60, status));
      await expect(service.create(valid)).resolves.toStrictEqual({
        ok: false,
        error: 'id_taken',
      });
      expect(findById).toHaveBeenCalledWith('A');
      expect(findActiveByResource).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    },
  );

  // The API can no longer create a booking that ends past the window, but one
  // stored before the window existed still occupies its interval.
  it('rejects an overlap with a stored booking that ends past the window', async () => {
    findActiveByResource.mockResolvedValue([booking('B', 90, 130)]);
    await expect(
      service.create({ ...valid, id: 'C', start: 95, end: 100 }),
    ).resolves.toStrictEqual({
      ok: false,
      error: 'conflict',
      conflicts: ['B'],
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('rejects an overlap with the conflicting ids in repository order', async () => {
    findActiveByResource.mockResolvedValue([
      booking('B', 20, 30),
      booking('A', 10, 20),
      booking('Z', 40, 50),
    ]);
    await expect(
      service.create({ id: 'C', resource: 'R1', start: 19, end: 21 }),
    ).resolves.toStrictEqual({
      ok: false,
      error: 'conflict',
      conflicts: ['B', 'A'],
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('accepts [20,30) after [10,20)', async () => {
    findActiveByResource.mockResolvedValue([booking('A', 10, 20)]);
    const result = await service.create({
      ...valid,
      id: 'B',
      start: 20,
      end: 30,
    });
    expect(result.ok).toBe(true);
  });

  it('asks the repository only for active bookings of the requested resource', async () => {
    await service.create(valid);
    expect(findActiveByResource).toHaveBeenCalledWith('R1');
  });

  it('checks in order', async () => {
    findResource.mockResolvedValue(null);
    findById.mockResolvedValue(booking('A', 50, 60));
    findActiveByResource.mockResolvedValue([booking('Z', 10, 20)]);

    await expect(
      service.create({ ...valid, start: -1 }),
    ).resolves.toMatchObject({
      error: 'invalid_data',
    });
    await expect(service.create(valid)).resolves.toMatchObject({
      error: 'unknown_resource',
    });
    findResource.mockResolvedValue(agora);
    await expect(service.create(valid)).resolves.toMatchObject({
      error: 'id_taken',
    });
    findById.mockResolvedValue(null);
    await expect(service.create(valid)).resolves.toMatchObject({
      error: 'conflict',
      conflicts: ['Z'],
    });
    expect(insert).not.toHaveBeenCalled();
  });

  describe('availability', () => {
    it('is available when nothing overlaps', async () => {
      await expect(service.availability('R1', 10, 20)).resolves.toStrictEqual({
        ok: true,
        available: true,
        conflicts: [],
      });
      expect(findActiveByResource).toHaveBeenCalledWith('R1');
      expect(insert).not.toHaveBeenCalled();
    });

    it('lists the overlapping bookings in repository order', async () => {
      findActiveByResource.mockResolvedValue([
        booking('A', 10, 20),
        booking('B', 20, 30),
      ]);
      await expect(
        service.availability('R1', '19', '21'),
      ).resolves.toStrictEqual({
        ok: true,
        available: false,
        conflicts: ['A', 'B'],
      });
    });

    it('keeps the order the repository returns', async () => {
      findActiveByResource.mockResolvedValue(
        ['10', '9', 'B', 'a'].map((id) => booking(id, 0, 5)),
      );
      await expect(service.availability('R1', 0, 5)).resolves.toMatchObject({
        conflicts: ['10', '9', 'B', 'a'],
      });
    });

    it('treats [20,30) after [10,20) as available', async () => {
      findActiveByResource.mockResolvedValue([booking('A', 10, 20)]);
      await expect(service.availability('R1', 20, 30)).resolves.toMatchObject({
        available: true,
        conflicts: [],
      });
    });

    it('never writes', async () => {
      findActiveByResource.mockResolvedValue([booking('A', 10, 20)]);
      await service.availability('R1', 15, 25);
      expect(insert).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing resource', undefined, 10, 20],
      ['an empty resource', '', 10, 20],
      ['a repeated resource', ['R1', 'R2'], 10, 20],
      ['a resource with NUL', 'R\u00001', 10, 20],
      ['a missing start', 'R1', undefined, 20],
      ['an empty start', 'R1', '', 20],
      ['a repeated start', 'R1', ['1', '2'], 20],
      ['a non-numeric start', 'R1', 'abc', 20],
      ['a decimal start', 'R1', '1.5', 20],
      ['a negative start', 'R1', '-1', 20],
      ['an end above the bookable window', 'R1', 0, 101],
      ['start equal to end', 'R1', 10, 10],
      ['start after end', 'R1', 20, 10],
    ])('rejects %s as invalid_data', async (_, resource, start, end) => {
      await expect(
        service.availability(resource, start, end),
      ).resolves.toStrictEqual({ ok: false, error: 'invalid_data' });
      expect(exists).not.toHaveBeenCalled();
    });

    it('rejects an unknown resource', async () => {
      exists.mockResolvedValue(false);
      await expect(service.availability('r1', 10, 20)).resolves.toStrictEqual({
        ok: false,
        error: 'unknown_resource',
      });
      expect(findActiveByResource).not.toHaveBeenCalled();
    });

    it('does not look up an id when none is sent', async () => {
      await service.availability('R1', 10, 20);
      expect(findById).not.toHaveBeenCalled();
    });

    it('answers normally when the sent id is free', async () => {
      findActiveByResource.mockResolvedValue([booking('A', 10, 20)]);
      await expect(
        service.availability('R1', 19, 21, 'C'),
      ).resolves.toStrictEqual({ ok: true, available: false, conflicts: ['A'] });
      expect(findById).toHaveBeenCalledWith('C');
    });

    it.each(['active', 'canceled'] as const)(
      'rejects an id used by a %s booking as id_taken, before the conflict lookup',
      async (status) => {
        findById.mockResolvedValue(booking('A', 50, 60, status));
        await expect(
          service.availability('R1', 10, 20, 'A'),
        ).resolves.toStrictEqual({ ok: false, error: 'id_taken' });
        expect(findActiveByResource).not.toHaveBeenCalled();
      },
    );

    it('checks unknown_resource before id_taken', async () => {
      exists.mockResolvedValue(false);
      findById.mockResolvedValue(booking('A', 50, 60));
      await expect(
        service.availability('R9', 10, 20, 'A'),
      ).resolves.toStrictEqual({ ok: false, error: 'unknown_resource' });
      expect(findById).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty id', ''],
      ['a repeated id', ['A', 'B']],
      ['an id with a space', 'A B'],
      ['an id over 64 characters', 'x'.repeat(65)],
    ])('rejects %s as invalid_data', async (_, id) => {
      await expect(
        service.availability('R1', 10, 20, id),
      ).resolves.toStrictEqual({ ok: false, error: 'invalid_data' });
      expect(exists).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    const view = (id: string, status: BookingStatus = 'active') => ({
      id,
      resource: { id: 'R1', name: 'Agora Room' },
      start: 10,
      end: 20,
      status,
    });

    it('returns the repository views in its order', async () => {
      const views = [view('10'), view('9', 'canceled'), view('B'), view('a')];
      findAllWithResource.mockResolvedValue(views);
      await expect(service.list()).resolves.toStrictEqual(views);
    });
  });

  describe('cancel', () => {
    const view = (status: BookingStatus) => ({
      id: 'A',
      resource: { id: 'R1', name: 'Agora Room' },
      start: 10,
      end: 20,
      status,
    });

    it('cancels an active booking', async () => {
      findByIdWithResource.mockResolvedValue(view('active'));
      await expect(service.cancel('A')).resolves.toStrictEqual({
        ok: true,
        result: 'canceled',
        booking: view('canceled'),
      });
      expect(findByIdWithResource).toHaveBeenCalledWith('A');
      expect(setStatus).toHaveBeenCalledTimes(1);
      expect(setStatus).toHaveBeenCalledWith('A', 'canceled');
    });

    it('answers already_canceled without writing', async () => {
      findByIdWithResource.mockResolvedValue(view('canceled'));
      await expect(service.cancel('A')).resolves.toStrictEqual({
        ok: true,
        result: 'already_canceled',
        booking: view('canceled'),
      });
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('returns not_found for an unknown id', async () => {
      findByIdWithResource.mockResolvedValue(null);
      await expect(service.cancel('Z')).resolves.toStrictEqual({
        ok: false,
        error: 'not_found',
      });
      expect(setStatus).not.toHaveBeenCalled();
    });

    it.each(['x'.repeat(65), 'R\u00001', 'A B', ''])(
      'returns not_found for %j without a query',
      async (id) => {
        await expect(service.cancel(id)).resolves.toStrictEqual({
          ok: false,
          error: 'not_found',
        });
        expect(findByIdWithResource).not.toHaveBeenCalled();
        expect(setStatus).not.toHaveBeenCalled();
      },
    );
  });
});
