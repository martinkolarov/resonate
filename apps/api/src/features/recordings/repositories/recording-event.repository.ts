import type { DB } from '@/types/db.generated.types.js';
import type { Kysely, Transaction } from 'kysely';

export function createRecordingEventRepository(postgres: Kysely<DB>) {
  return {
    async create(
      {
        recordingId,
        processingJobId,
        status,
        processingStage,
        failedReason,
      }: {
        recordingId: string;
        processingJobId: string;
        status: string;
        processingStage: string | null;
        failedReason?: string | null;
      },
      trx: Transaction<DB>
    ) {
      return await trx
        .insertInto('recording_events')
        .values({
          recording_id: recordingId,
          processing_job_id: processingJobId,
          status,
          processing_stage: processingStage,
          failed_reason: failedReason ?? null,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    },
    async listByRecordingId(recordingId: string) {
      return await postgres
        .selectFrom('recording_events')
        .selectAll()
        .where('recording_id', '=', recordingId)
        .orderBy('id', 'asc')
        .execute();
    },
    async listByRecordingIdAfterCursor(recordingId: string, recordingEventId: string) {
      return await postgres
        .selectFrom('recording_events')
        .selectAll()
        .where('recording_id', '=', recordingId)
        .where('id', '>', recordingEventId)
        .orderBy('id', 'asc')
        .execute();
    },
  };
}

export type RecordingEventRepository = ReturnType<typeof createRecordingEventRepository>;
