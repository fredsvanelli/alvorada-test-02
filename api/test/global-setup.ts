// Recreates the test database before every Vitest run, so specs never touch the dev database.
// The name comes from `test.env.POSTGRES_DB` in vitest.config.ts; host and credentials from api/.env.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { DataSource, type MigrationInterface } from 'typeorm';
import type { TestProject } from 'vitest/node';

const MIGRATIONS_DIR = join(import.meta.dirname, '../src/database/migrations');

export async function setup(project: TestProject): Promise<void> {
  const env = { ...parseEnv(readFileSync('.env', 'utf8')), ...process.env };
  const database = project.config.env.POSTGRES_DB;
  if (!database?.endsWith('_test')) {
    throw new Error(`Refusing to recreate "${database}": the test database name must end in _test`);
  }
  const connect = (name: string, migrations: (new () => MigrationInterface)[] = []) =>
    new DataSource({
      type: 'postgres',
      host: env.POSTGRES_HOST,
      port: Number(env.POSTGRES_PORT),
      username: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: name,
      migrations,
    }).initialize();

  const admin = await connect('postgres');
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.destroy();
  }

  // Imported here rather than by glob: under Vitest the migrations are .ts, which the app's *.js glob skips.
  const migrations: (new () => MigrationInterface)[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.ts'))) {
    const module = (await import(join(MIGRATIONS_DIR, file))) as Record<string, new () => MigrationInterface>;
    migrations.push(...Object.values(module));
  }
  const testDb = await connect(database, migrations);
  try {
    await testDb.runMigrations();
  } finally {
    await testDb.destroy();
  }
}
