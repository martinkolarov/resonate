import { defineConfig } from 'kysely-ctl';
import { db } from '@/infrastructure/db.js';

export default defineConfig({
  kysely: db,
  migrations: {
    migrationFolder: './migrations',
  },
});
