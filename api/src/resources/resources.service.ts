import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './resource.entity.js';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private readonly resources: Repository<Resource>,
  ) {}

  list(): Promise<Resource[]> {
    return this.resources.find({ order: { id: 'ASC' } });
  }

  exists(id: string): Promise<boolean> {
    return this.resources.exists({ where: { id } });
  }
}
