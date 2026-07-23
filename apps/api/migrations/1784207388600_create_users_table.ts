import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'uuid', column => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', column => column.notNull())
    .addColumn('name', 'varchar(255)', column => column.notNull())
    .addColumn('password', 'text', column => column.notNull())
    .addColumn('email_verified_at', 'timestamptz')
    .execute();

  await db.schema.createIndex('users_email_idx').on('users').columns(['email']).execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable('users').execute();
}
