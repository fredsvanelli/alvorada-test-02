// Runbook resources.list-resources (docs/runbooks/resources/list-resources.md). Change the runbook first, then /runbooks:to-test resources.list-resources.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';

describe('List the bookable resources', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('S01 A client lists all five seeded resources in ascending id order', async () => {
    const response = await fetch(`${baseUrl}/resources`);

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([
      { id: 'R1', name: 'Agora Room' },
      { id: 'R2', name: 'Pixel Room' },
      { id: 'R3', name: '4K Projector' },
      { id: 'R4', name: 'Orbit Room' },
      { id: 'R5', name: 'Focus Room' },
    ]);
  });
});
