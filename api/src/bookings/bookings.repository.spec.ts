import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Booking } from './booking.entity.js';
import { BookingsRepository } from './bookings.repository.js';

describe('BookingsRepository', () => {
  const query = vi.fn();
  let repository: BookingsRepository;

  const row = {
    id: 'A',
    start_time: 10,
    end_time: 20,
    status: 'canceled',
    resource_id: 'R1',
    resource_name: 'Agora Room',
  };
  const view = {
    id: 'A',
    resource: { id: 'R1', name: 'Agora Room' },
    start: 10,
    end: 20,
    status: 'canceled',
  };

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsRepository,
        { provide: getRepositoryToken(Booking), useValue: { query } },
      ],
    }).compile();
    repository = moduleRef.get(BookingsRepository);
  });

  it('maps every joined row to a booking view, in id order by character code', async () => {
    query.mockResolvedValue([row]);
    await expect(repository.findAllWithResource()).resolves.toStrictEqual([
      view,
    ]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JOIN resource r ON r.id = b.resource_id');
    expect(sql).toContain('ORDER BY b.id COLLATE "C"');
    expect(sql).not.toContain('WHERE');
    expect(params).toStrictEqual([]);
  });

  it('finds one booking view by id as a bound parameter', async () => {
    query.mockResolvedValue([row]);
    await expect(repository.findByIdWithResource('A')).resolves.toStrictEqual(
      view,
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE b.id = $1');
    expect(params).toStrictEqual(['A']);
  });

  it('returns null when no booking has the id', async () => {
    query.mockResolvedValue([]);
    await expect(repository.findByIdWithResource('Z')).resolves.toBeNull();
  });
});
