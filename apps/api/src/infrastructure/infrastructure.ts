import { db } from '@/infrastructure/db.js';
import { createOutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import { createTransactionRunner } from '@/infrastructure/transaction-runner.js';
import { createS3ObjectStorage } from './object-storage/s3-object-storage.js';
import env from '@/env.js';

export function createInfrastructure() {
  return {
    db,
    objectStorage: createS3ObjectStorage({ bucket: env.AWS_S3_BUCKET, region: env.AWS_REGION }),
    outboxMessages: createOutboxMessageRepository(db),
    transactionRunner: createTransactionRunner(db),
  };
}

export type Infrastructure = ReturnType<typeof createInfrastructure>;
