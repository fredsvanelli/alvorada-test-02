// Runbook health.check-database (docs/runbooks/health/check-database.md). Change the runbook first, then /runbooks:to-test health.check-database.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';

describe('The API reports whether it can reach the database', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    dataSource = app.get(DataSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('S01 The API reports ok when the database answers', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('S02 The API answers 503 when the database query fails', async () => {
    vi.spyOn(dataSource, 'query').mockRejectedValueOnce(
      new Error('connection lost'),
    );

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      message: 'Service Unavailable',
      statusCode: 503,
    });
  });

  it(
    'S03 The API answers 503 after 2 seconds when the database does not answer',
    async () => {
      vi.spyOn(dataSource, 'query').mockReturnValueOnce(
        new Promise(() => {}),
      );

      const sentAt = performance.now();
      const response = await fetch(`${baseUrl}/health`);
      const elapsed = performance.now() - sentAt;

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        message: 'Service Unavailable',
        statusCode: 503,
      });
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    },
    10_000,
  );
});
