import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'uuid', column => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', column =>
      column.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('hashed_token', 'text', column => column.notNull().unique())
    .addColumn('created_at', 'timestamptz', column => column.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', column => column.notNull())
    .execute();

  await db.schema.createIndex('sessions_user_id_idx').on('sessions').columns(['user_id']).execute();
  await db.schema
    .createIndex('sessions_expires_at_idx')
    .on('sessions')
    .columns(['expires_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sessions').execute();
}
