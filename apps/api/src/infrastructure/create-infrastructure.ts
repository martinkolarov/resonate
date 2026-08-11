import { db } from '@/infrastructure/db.js';
import { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import { KyselyTransactionRunner } from '@/infrastructure/transaction-runner.js';

export function createInfrastructure() {
  return {
    db,
    outboxMessages: new OutboxMessageRepository(db),
    transactionRunner: new KyselyTransactionRunner(db),
  };
}

export type Infrastructure = ReturnType<typeof createInfrastructure>;
