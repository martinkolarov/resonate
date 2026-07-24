import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import env from '@/env.js';
import type { DB } from '@/types/db.generated.types.js';
import { logger } from '@/infrastructure/logger.js';
const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const dbLogger = logger.child({ module: 'database' });
pool.on('error', error => {
  dbLogger.error({ error }, 'Unexpected PostgreSQL pool error');
});

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});
