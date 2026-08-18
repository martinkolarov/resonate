import { createPostgres } from '@/infrastructure/postgres.js';
import { createOutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import { createTransactionRunner } from '@/infrastructure/transaction-runner.js';
import { createS3ObjectStorage } from './object-storage/s3-object-storage.js';
import env from '@/env.js';
import { createRedis } from './redis.js';
import { createMongo } from './mongo.js';

export function createInfrastructure() {
  const postgres = createPostgres({ connectionString: env.DATABASE_URL });
  const redis = createRedis({ url: env.REDIS_URL });
  const mongo = createMongo({
    uri: env.MONGO_URI,
    databaseName: env.MONGO_DATABASE,
  });

  return {
    postgres: postgres.client,
    redis: redis.client,
    mongo: mongo.db,
    objectStorage: createS3ObjectStorage({
      bucket: env.AWS_S3_BUCKET,
      endpoint: env.AWS_S3_ENDPOINT,
      region: env.AWS_REGION,
    }),
    outboxMessages: createOutboxMessageRepository(postgres.client),
    transactionRunner: createTransactionRunner(postgres.client),

    async connect() {
      const results = await Promise.allSettled([
        postgres.connect(),
        redis.connect(),
        mongo.connect(),
      ]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) {
        await Promise.allSettled([mongo.close(), redis.close(), postgres.close()]);
        throw failure.reason;
      }
    },

    async close() {
      const results = await Promise.allSettled([mongo.close(), redis.close(), postgres.close()]);

      const failure = results.find(result => result.status === 'rejected');
      if (failure) {
        throw failure.reason;
      }
    },
  };
}

export type Infrastructure = ReturnType<typeof createInfrastructure>;
