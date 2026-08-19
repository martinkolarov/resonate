import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('recordings')
    .addColumn('id', 'uuid', column => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', column =>
      column.notNull().references('users.id').onDelete('cascade')
    )
    .addColumn('status', 'text', column => column.notNull().defaultTo('uploading'))
    .addColumn('processing_stage', 'text')
    .addColumn('failed_reason', 'text')
    .addColumn('file_name', 'text')
    .addColumn('object_key', 'text', column => column.notNull().unique())
    .addColumn('provider', 'text', column => column.notNull())
    .addColumn('size_bytes', 'bigint')
    .addColumn('mime_type', 'text')
    .addColumn('duration_ms', 'integer')
    .addColumn('created_at', 'timestamptz', column => column.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'recording_status_check',
      sql`status in ('uploading', 'uploaded', 'processing', 'ready', 'failed')`
    )
    .addCheckConstraint(
      'recording_processing_stage_check',
      sql`processing_stage in ('validating', 'transcoding', 'transcribing', 'summarizing')`
    )
    .execute();

  await db.schema
    .createIndex('recording_user_id_created_at_idx')
    .on('recordings')
    .columns(['user_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('recordings').execute();
}
