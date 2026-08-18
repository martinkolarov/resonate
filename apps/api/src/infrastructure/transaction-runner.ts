import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export interface TransactionRunner {
  run<T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T>;
}

export function createTransactionRunner(postgres: Kysely<DB>): TransactionRunner {
  return {
    async run<T>(callback: (trx: Transaction<DB>) => Promise<T>) {
      return await postgres.transaction().execute(callback);
    },
  };
}
