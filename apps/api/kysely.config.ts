import { defineConfig } from 'kysely-ctl';
import { db } from '@/infrastructure/postgres.js';

export default defineConfig({
  kysely: db,
  migrations: {
    migrationFolder: './migrations',
  },
});
