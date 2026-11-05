import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsController', () => {
  const create = vi.fn();
  const availability = vi.fn();
  let controller: BookingsController;

  const body = { id: 'A', resource: 'R1', start: 10, end: 20 };

  beforeEach(async () => {
    create.mockReset();
    availability.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        { provide: BookingsService, useValue: { create, availability } },
      ],
    }).compile();
    controller = moduleRef.get(BookingsController);
  });

  async function thrown(): Promise<HttpException> {
    const error: unknown = await controller.create(body).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    return error as HttpException;
  }

  it('returns the created booking with its resource nested', async () => {
    const booking = {
      ...body,
      resource: { id: 'R1', name: 'Agora Room' },
      status: 'active',
    };
    create.mockResolvedValue({ ok: true, booking });
    await expect(controller.create(body)).resolves.toBe(booking);
    expect(create).toHaveBeenCalledWith(body);
  });

  it.each([
    ['invalid_data', 422],
    ['unknown_resource', 404],
    ['id_taken', 409],
  ])('maps %s to %i with the error body', async (code, status) => {
    create.mockResolvedValue({ ok: false, error: code });
    const error = await thrown();
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toStrictEqual({
      error: code,
      message: expect.any(String),
    });
  });

  it('returns conflicts on a conflict', async () => {
    create.mockResolvedValue({
      ok: false,
      error: 'conflict',
      conflicts: ['A', 'B'],
    });
    const error = await thrown();
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toStrictEqual({
      error: 'conflict',
      message: expect.any(String),
      conflicts: ['A', 'B'],
    });
  });

  describe('availability', () => {
    async function thrownByAvailability(): Promise<HttpException> {
      const error: unknown = await controller
        .availability('R1', '19', '21')
        .catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      return error as HttpException;
    }

    it('returns available and conflicts', async () => {
      availability.mockResolvedValue({
        ok: true,
        available: false,
        conflicts: ['A', 'B'],
      });
      await expect(
        controller.availability('R1', '19', '21'),
      ).resolves.toStrictEqual({ available: false, conflicts: ['A', 'B'] });
      expect(availability).toHaveBeenCalledWith('R1', '19', '21');
    });

    it.each([
      ['invalid_data', 422],
      ['unknown_resource', 404],
    ])('maps availability %s to %i', async (code, status) => {
      availability.mockResolvedValue({ ok: false, error: code });
      const error = await thrownByAvailability();
      expect(error.getStatus()).toBe(status);
      expect(error.getResponse()).toStrictEqual({
        error: code,
        message: expect.any(String),
      });
    });

    it('asks for resource, start and end on invalid_data', async () => {
      availability.mockResolvedValue({ ok: false, error: 'invalid_data' });
      const error = await thrownByAvailability();
      expect(error.getResponse()).toMatchObject({
        message:
          'Send resource, and integer start and end from 0 to 2147483647 with start before end.',
      });
    });
  });
});
