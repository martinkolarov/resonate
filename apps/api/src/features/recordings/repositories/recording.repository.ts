import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export function createRecordingRepository(postgres: Kysely<DB>) {
  return {
    async create({
      userId,
      inputObjectKey,
      fileName,
      storageProvider,
    }: {
      userId: string;
      inputObjectKey: string;
      fileName?: string;
      storageProvider: string;
    }) {
      return await postgres
        .insertInto('recordings')
        .values({
          user_id: userId,
          input_object_key: inputObjectKey,
          file_name: fileName,
          storage_provider: storageProvider,
        })
        .returning('id')
        .executeTakeFirst();
    },

    async getById(recordingId: string) {
      return await postgres
        .selectFrom('recordings')
        .selectAll()
        .where('id', '=', recordingId)
        .limit(1)
        .executeTakeFirst();
    },

    async listByUserId(userId: string) {
      return await postgres
        .selectFrom('recordings')
        .select(['id', 'file_name', 'status', 'created_at'])
        .where('user_id', '=', userId)
        .execute();
    },

    async markUploaded(userId: string, recordingId: string, trx?: Transaction<DB>) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({ status: 'uploaded' })
        .where('status', '=', 'uploading')
        .where('id', '=', recordingId)
        .where('user_id', '=', userId)
        .returning(['id'])
        .executeTakeFirst();
    },

    async markFailed(
      recordingId: string,
      processingStage: string,
      message: string,
      trx?: Transaction<DB>
    ) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({ status: 'failed', failed_reason: message })
        .where('status', '=', 'processing')
        .where('processing_stage', '=', processingStage)
        .where('id', '=', recordingId)
        .returningAll()
        .executeTakeFirst();
    },

    async startValidation(recordingId: string, trx?: Transaction<DB>) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({
          status: 'processing',
          processing_stage: 'validating',
        })
        .where('id', '=', recordingId)
        .where('status', '=', 'uploaded')
        .where('processing_stage', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },

    async completeValidation(
      recordingId: string,
      data: {
        sizeBytes: number;
        inputMimeType: string;
        durationMs: number;
      },
      trx?: Transaction<DB>
    ) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({
          processing_stage: 'transcoding',
          size_bytes: data.sizeBytes,
          input_mime_type: data.inputMimeType,
          duration_ms: data.durationMs,
        })
        .where('id', '=', recordingId)
        .where('status', '=', 'processing')
        .where('processing_stage', '=', 'validating')
        .returningAll()
        .executeTakeFirst();
    },

    async completeTranscoding(
      recordingId: string,
      outputObjectKey: string,
      outputMimeType: string,
      trx?: Transaction<DB>
    ) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({
          processing_stage: 'transcribing',
          output_object_key: outputObjectKey,
          output_mime_type: outputMimeType,
        })
        .where('id', '=', recordingId)
        .where('status', '=', 'processing')
        .where('processing_stage', '=', 'transcoding')
        .returningAll()
        .executeTakeFirst();
    },

    async completeTranscription(recordingId: string, trx?: Transaction<DB>) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({
          processing_stage: 'summarizing',
        })
        .where('id', '=', recordingId)
        .where('status', '=', 'processing')
        .where('processing_stage', '=', 'transcribing')
        .returningAll()
        .executeTakeFirst();
    },

    async completeSummarization(recordingId: string, trx?: Transaction<DB>) {
      return await (trx ?? postgres)
        .updateTable('recordings')
        .set({
          status: 'ready',
          processing_stage: null,
        })
        .where('id', '=', recordingId)
        .where('status', '=', 'processing')
        .where('processing_stage', '=', 'summarizing')
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type RecordingRepository = ReturnType<typeof createRecordingRepository>;
