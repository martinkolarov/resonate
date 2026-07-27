import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'uuid', column => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', column => column.notNull())
    .addColumn('name', 'varchar(255)', column => column.notNull())
    .addColumn('password', 'text', column => column.notNull())
    .addColumn('provider', 'text', column => column.defaultTo('local'))
    .addColumn('email_verified_at', 'timestamptz')
    .addUniqueConstraint('users_email_provider_unique', ['email', 'provider'])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable('users').execute();
}
