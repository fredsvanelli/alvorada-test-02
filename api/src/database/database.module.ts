import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('POSTGRES_HOST'),
        port: Number(config.getOrThrow('POSTGRES_PORT')),
        username: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        database: config.getOrThrow<string>('POSTGRES_DB'),
        retryAttempts: 3,
        migrationsRun: true,
        // .js only: the build also emits .d.ts files, which are not migrations.
        migrations: [import.meta.dirname + '/migrations/*.js'],
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
