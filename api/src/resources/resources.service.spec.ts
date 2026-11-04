import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Resource } from './resource.entity.js';
import { ResourcesService } from './resources.service.js';

describe('ResourcesService', () => {
  const find = vi.fn();
  const exists = vi.fn();
  let service: ResourcesService;

  const rows = [
    { id: 'R1', name: 'Agora Room' },
    { id: 'R2', name: 'Pixel Room' },
  ];

  beforeEach(async () => {
    find.mockReset();
    exists.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: getRepositoryToken(Resource), useValue: { find, exists } },
      ],
    }).compile();
    service = moduleRef.get(ResourcesService);
  });

  it('lists resources sorted by id in the query', async () => {
    find.mockResolvedValue(rows);
    await expect(service.list()).resolves.toEqual(rows);
    expect(find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
  });

  it('returns true for a seeded id', async () => {
    exists.mockResolvedValue(true);
    await expect(service.exists('R1')).resolves.toBe(true);
    expect(exists).toHaveBeenCalledWith({ where: { id: 'R1' } });
  });

  it('returns false for an unknown id', async () => {
    exists.mockResolvedValue(false);
    await expect(service.exists('R9')).resolves.toBe(false);
  });

  it('passes the id through unchanged, so case matters', async () => {
    exists.mockResolvedValue(false);
    await service.exists('r1');
    expect(exists).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('asks the database on every call', async () => {
    exists.mockResolvedValue(true);
    await service.exists('R1');
    await service.exists('R1');
    expect(exists).toHaveBeenCalledTimes(2);
  });
});
