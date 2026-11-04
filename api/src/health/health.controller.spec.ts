import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const query = vi.fn();
  let controller: HealthController;

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: { query } }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns ok when SELECT 1 succeeds', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('throws ServiceUnavailableException when the query fails', async () => {
    query.mockRejectedValue(new Error('connection lost'));
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when the query does not answer within 2 seconds', async () => {
    vi.useFakeTimers();
    try {
      query.mockReturnValue(new Promise(() => {}));
      const result = expect(controller.check()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await vi.advanceTimersByTimeAsync(2000);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});
