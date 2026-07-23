import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import env from '@/env.js';
import type { DB } from '@/types/db.generated.types.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', error => {
  console.error('Unexpected pool error', error);
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});
