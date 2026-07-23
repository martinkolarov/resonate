import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('email_verifications')
    .ifNotExists()
    .addColumn('user_id', 'uuid', column =>
      column.primaryKey().references('users.id').onDelete('cascade')
    )
    .addColumn('hashed_code', 'text', column => column.notNull().unique())
    .addColumn('created_at', 'timestamptz', column => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', column => column.notNull())
    .execute();

  await db.schema
    .createIndex('email_verifications_expires_at_idx')
    .on('email_verifications')
    .columns(['expires_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('email_verifications').execute();
}
