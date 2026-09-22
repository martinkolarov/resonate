import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('recording_events')
    .addColumn('id', 'bigint', column => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('recording_id', 'uuid', column =>
      column.notNull().references('recordings.id').onDelete('cascade')
    )
    .addColumn('processing_job_id', 'text', column => column.notNull())
    .addColumn('status', 'text', column => column.notNull())
    .addColumn('processing_stage', 'text')
    .addColumn('failed_reason', 'text')
    .addColumn('created_at', 'timestamptz', column => column.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('recording_event_id_recording_id_idx')
    .on('recording_events')
    .columns(['recording_id', 'id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('recording_events').execute();
}
