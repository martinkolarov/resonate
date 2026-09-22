import type { DB } from '@/types/db.generated.types.js';
import type { Transaction } from 'kysely';

type CreateRecordingEvent = {
  recordingId: string;
  processingJobId: string;
  status: string;
  processingStage: string | null;
  failedReason?: string | null;
};

export function createRecordingEventRepository() {
  return {
    async create(
      { recordingId, processingJobId, status, processingStage, failedReason }: CreateRecordingEvent,
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
  };
}

export type RecordingEventRepository = ReturnType<typeof createRecordingEventRepository>;
