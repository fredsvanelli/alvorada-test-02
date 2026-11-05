import { Test } from '@nestjs/testing';
import { ResourcesService } from '../resources/resources.service.js';
import type { Booking, BookingStatus } from './booking.entity.js';
import { BookingsRepository } from './bookings.repository.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService', () => {
  const findById = vi.fn();
  const findActiveByResource = vi.fn();
  const insert = vi.fn();
  const exists = vi.fn();
  let service: BookingsService;

  const valid = { id: 'A', resource: 'R1', start: 10, end: 20 };

  const booking = (
    id: string,
    start: number,
    end: number,
    status: BookingStatus = 'active',
  ): Booking => ({ id, resource: 'R1', start, end, status });

  beforeEach(async () => {
    for (const fn of [findById, findActiveByResource, insert, exists]) {
      fn.mockReset();
    }
    exists.mockResolvedValue(true);
    findById.mockResolvedValue(null);
    findActiveByResource.mockResolvedValue([]);
    insert.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: BookingsRepository,
          useValue: { findById, findActiveByResource, insert },
        },
        { provide: ResourcesService, useValue: { exists } },
      ],
    }).compile();
    service = moduleRef.get(BookingsService);
  });

  it('creates an active booking', async () => {
    const created = { ...valid, status: 'active' };
    await expect(service.create(valid)).resolves.toStrictEqual({
      ok: true,
      booking: created,
    });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(created);
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
    ['an end above the integer range', { ...valid, end: 2147483648 }],
    ['an empty interval', { ...valid, start: 20, end: 20 }],
    ['a decimal start', { ...valid, start: 10.5 }],
  ])('rejects invalid data: %s', async (_, body) => {
    await expect(service.create(body)).resolves.toStrictEqual({
      ok: false,
      error: 'invalid_data',
    });
    expect(exists).not.toHaveBeenCalled();
    expect(findById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('accepts a 64-character id', async () => {
    const result = await service.create({ ...valid, id: 'x'.repeat(64) });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown resource', async () => {
    exists.mockResolvedValue(false);
    await expect(service.create(valid)).resolves.toStrictEqual({
      ok: false,
      error: 'unknown_resource',
    });
    expect(findById).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('passes resource unchanged', async () => {
    exists.mockResolvedValue(false);
    const result = await service.create({ ...valid, resource: ' R1' });
    expect(exists).toHaveBeenCalledWith(' R1');
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
    exists.mockResolvedValue(false);
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
    exists.mockResolvedValue(true);
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
      ['an end above the integer range', 'R1', 0, 2147483648],
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
  });
});
