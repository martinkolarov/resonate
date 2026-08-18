import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export function createRecordingRepository(postgres: Kysely<DB>) {
  return {
    async create({
      userId,
      objectKey,
      fileName,
      mimeType,
      provider,
    }: {
      userId: string;
      objectKey: string;
      fileName?: string;
      mimeType: string;
      provider: string;
    }) {
      return await postgres
        .insertInto('recordings')
        .values({
          user_id: userId,
          object_key: objectKey,
          file_name: fileName,
          mime_type: mimeType,
          provider,
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

    async markFailed(recordingId: string, message: string) {
      return await postgres
        .updateTable('recordings')
        .set({ status: 'failed', failed_reason: message })
        .where('id', '=', recordingId)
        .execute();
    },

    async completeValidation(recordingId: string, sizeBytes: number, mimeType: string) {
      return await postgres
        .updateTable('recordings')
        .set({ size_bytes: sizeBytes, mime_type: mimeType, processing_stage: 'encoding' })
        .where('id', '=', recordingId)
        .execute();
    },

    async updateProcessingStage(recordingId: string, newProcessingStage: string) {
      return await postgres
        .updateTable('recordings')
        .set({
          processing_stage: newProcessingStage,
        })
        .where('id', '=', recordingId)
        .execute();
    },

    async listByUserId(userId: string) {
      return await postgres
        .selectFrom('recordings')
        .select(['id', 'file_name', 'status', 'created_at'])
        .where('user_id', '=', userId)
        .execute();
    },
  };
}

export type RecordingRepository = ReturnType<typeof createRecordingRepository>;
