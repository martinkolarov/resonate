import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('users_email_idx').execute();
  await db.schema
    .createIndex('users_email_unique_idx')
    .unique()
    .on('users')
    .column('email')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('users_email_unique_idx').execute();
  await db.schema.createIndex('users_email_idx').on('users').column('email').execute();
}
