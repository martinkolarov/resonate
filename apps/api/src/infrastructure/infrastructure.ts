import { db } from '@/infrastructure/db.js';
import { createOutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import { createTransactionRunner } from '@/infrastructure/transaction-runner.js';

export function createInfrastructure() {
  return {
    db,
    outboxMessages: createOutboxMessageRepository(db),
    transactionRunner: createTransactionRunner(db),
  };
}

export type Infrastructure = ReturnType<typeof createInfrastructure>;
