import { Controller, Get } from '@nestjs/common';
import { Resource } from './resource.entity.js';
import { ResourcesService } from './resources.service.js';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  list(): Promise<Resource[]> {
    return this.resources.list();
  }
}
