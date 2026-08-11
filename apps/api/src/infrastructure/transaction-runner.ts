import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export interface TransactionRunner {
  run<T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T>;
}

export class KyselyTransactionRunner implements TransactionRunner {
  constructor(private readonly db: Kysely<DB>) {}

  async run<T>(callback: (trx: Transaction<DB>) => Promise<T>) {
    return await this.db.transaction().execute(callback);
  }
}
