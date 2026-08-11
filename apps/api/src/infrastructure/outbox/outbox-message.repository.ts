import { DB } from '@/types/db.generated.types.js';
import { Kysely, sql, Transaction } from 'kysely';

export class OutboxMessageRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async claimAvailable(limit: number) {
    return await this.db.transaction().execute(async trx => {
      const messages = await trx
        .selectFrom('outbox_messages')
        .select(['id', 'type', 'payload'])
        .where('available_at', '<=', sql<Date>`now()`)
        .where('processed_at', 'is', null)
        .where(eb =>
          eb.or([eb('locked_until', '<=', sql<Date>`now()`), eb('locked_until', 'is', null)])
        )
        .limit(limit)
        .forUpdate('outbox_messages')
        .skipLocked()
        .orderBy('created_at', 'asc')
        .execute();

      if (messages.length === 0) {
        return [];
      }

      await trx
        .updateTable('outbox_messages')
        .set({
          locked_until: sql`now() + interval '60 seconds'`,
        })
        .where(
          'id',
          'in',
          messages.map(message => message.id)
        )
        .execute();

      return messages;
    });
  }

  async enqueue(trx: Transaction<DB>, type: string, payload: unknown) {
    await trx
      .insertInto('outbox_messages')
      .values({
        type: type,
        payload: JSON.stringify(payload),
        available_at: sql`now()`,
      })
      .execute();
  }

  async markProcessed(id: string) {
    await this.db
      .updateTable('outbox_messages')
      .set({
        processed_at: sql`now()`,
        locked_until: null,
        last_error: null,
      })
      .where('id', '=', id)
      .where('processed_at', 'is', null)
      .execute();
  }

  async scheduleRetry(id: string, availableAt: Date, error: Error) {
    await this.db
      .updateTable('outbox_messages')
      .set({
        available_at: availableAt,
        locked_until: null,
        last_error: JSON.stringify({
          name: error.name,
          message: error.message,
          stack: error.stack,
        }),
      })
      .where('id', '=', id)
      .where('processed_at', 'is', null)
      .execute();
  }
}
