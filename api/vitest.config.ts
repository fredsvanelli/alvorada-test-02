import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Specs boot AppModule against this disposable database, recreated and seeded by the global setup.
    env: { POSTGRES_DB: 'bookings_test' },
    globalSetup: ['./test/global-setup.ts'],
    // Runbook specs share bookings_test and empty the booking table in
    // beforeEach, so files must not run in parallel.
    // ponytail: serial files; one database per worker if the suite gets slow.
    fileParallelism: false,
  },
});
