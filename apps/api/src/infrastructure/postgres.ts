import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import type { DB } from '@/types/db.generated.types.js';
import { logger } from '@/infrastructure/observability/logger.js';

const { Pool } = pg;

const postgresLogger = logger.child({ component: 'postgres' });

type PostgresConfig = {
  connectionString: string;
};

export function createPostgres({ connectionString }: PostgresConfig) {
  const pool = new Pool({ connectionString });

  pool.on('error', error => {
    postgresLogger.error({ err: error }, 'Unexpected PostgreSQL pool error');
  });

  const client = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  });

  return {
    client,

    async connect() {
      await sql`select 1`.execute(client);
      postgresLogger.info('PostgreSQL connected');
    },

    async close() {
      await client.destroy();
      postgresLogger.info('PostgreSQL connection closed');
    },
  };
}

export type Postgres = ReturnType<typeof createPostgres>;
