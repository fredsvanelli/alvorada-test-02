import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Resource } from './resource.entity.js';
import { ResourcesService } from './resources.service.js';

describe('ResourcesService', () => {
  const find = vi.fn();
  const exists = vi.fn();
  const findOneBy = vi.fn();
  let service: ResourcesService;

  const rows = [
    { id: 'R1', name: 'Agora Room' },
    { id: 'R2', name: 'Pixel Room' },
  ];

  beforeEach(async () => {
    find.mockReset();
    exists.mockReset();
    findOneBy.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResourcesService,
        {
          provide: getRepositoryToken(Resource),
          useValue: { find, exists, findOneBy },
        },
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

  it('finds a resource by id', async () => {
    findOneBy.mockResolvedValue(rows[0]);
    await expect(service.findById('R1')).resolves.toBe(rows[0]);
    expect(findOneBy).toHaveBeenCalledWith({ id: 'R1' });
  });

  it('returns null for an unknown id', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.findById('R9')).resolves.toBeNull();
  });

  it('asks the database on every call', async () => {
    exists.mockResolvedValue(true);
    await service.exists('R1');
    await service.exists('R1');
    expect(exists).toHaveBeenCalledTimes(2);
  });
});
