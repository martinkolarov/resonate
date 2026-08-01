import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('outbox_messages')
    .addColumn('id', 'uuid', column => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('type', 'text', column => column.notNull())
    .addColumn('payload', 'text', column => column.notNull())
    .addColumn('last_error', 'text')
    .addColumn('processed_at', 'timestamptz')
    .addColumn('available_at', 'timestamptz', column => column.notNull())
    .addColumn('locked_until', 'timestamptz')
    .addColumn('created_at', 'timestamptz', column => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('outbox_message_type_idx')
    .on('outbox_messages')
    .columns(['type'])
    .execute();

  await db.schema
    .createIndex('outbox_message_claim_idx')
    .on('outbox_messages')
    .columns(['available_at', 'created_at'])
    .where(sql.ref('processed_at'), 'is', null)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('outbox_messages').execute();
}
