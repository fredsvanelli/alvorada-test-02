import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    let timer: NodeJS.Timeout | undefined;
    // A frozen Postgres never answers; fail the probe instead of hanging.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('health check timed out')),
        2000,
      );
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
    } catch {
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
    }
    return { status: 'ok' };
  }
}
