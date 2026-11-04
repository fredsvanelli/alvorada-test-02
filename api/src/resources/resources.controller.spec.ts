import { Test } from '@nestjs/testing';
import { ResourcesController } from './resources.controller.js';
import { ResourcesService } from './resources.service.js';

describe('ResourcesController', () => {
  const list = vi.fn();
  let controller: ResourcesController;

  beforeEach(async () => {
    list.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [{ provide: ResourcesService, useValue: { list } }],
    }).compile();
    controller = moduleRef.get(ResourcesController);
  });

  it('returns the service list as a plain array', async () => {
    const rows = [
      { id: 'R1', name: 'Agora Room' },
      { id: 'R2', name: 'Pixel Room' },
    ];
    list.mockResolvedValue(rows);
    await expect(controller.list()).resolves.toEqual(rows);
  });
});
