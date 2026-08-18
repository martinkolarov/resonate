import { logger } from '@/infrastructure/observability/logger.js';
import { MongoClient } from 'mongodb';

type MongoConfig = {
  uri: string;
  databaseName: string;
};

const mongoLogger = logger.child({ component: 'mongodb' });

export function createMongo({ uri, databaseName }: MongoConfig) {
  const client = new MongoClient(uri, {
    appName: 'resonate',
  });
  const db = client.db(databaseName);

  return {
    db,

    async connect() {
      await client.connect();
      await db.command({ ping: 1 });
      mongoLogger.info({ databaseName }, 'MongoDB connected');
    },

    async close() {
      await client.close();
      mongoLogger.info('MongoDB connection closed');
    },
  };
}

export type Mongo = ReturnType<typeof createMongo>;
