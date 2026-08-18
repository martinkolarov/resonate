import { defineConfig } from 'kysely-ctl';
import { createPostgres } from '@/infrastructure/postgres.js';
import env from '@/env.js';

const postgres = createPostgres({ connectionString: env.DATABASE_URL });

export default defineConfig({
  kysely: postgres.client,
  migrations: {
    migrationFolder: './migrations',
  },
});
