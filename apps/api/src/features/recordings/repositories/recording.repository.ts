import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export function createRecordingRepository(db: Kysely<DB>) {
  return {
    async create({
      userId,
      objectKey,
      fileName,
      provider,
    }: {
      userId: string;
      objectKey: string;
      fileName?: string;
      provider: string;
    }) {
      return await db
        .insertInto('recordings')
        .values({
          user_id: userId,
          object_key: objectKey,
          file_name: fileName,
          provider,
        })
        .returning('id')
        .executeTakeFirst();
    },

    async getById(id: string) {
      return await db
        .selectFrom('recordings')
        .selectAll()
        .where('id', '=', id)
        .limit(1)
        .executeTakeFirst();
    },

    async markUploaded(userId: string, recordingId: string, trx?: Transaction<DB>) {
      return await (trx ?? db)
        .updateTable('recordings')
        .set({ status: 'uploaded' })
        .where('status', '=', 'uploading')
        .where('id', '=', recordingId)
        .where('user_id', '=', userId)
        .returning(['id'])
        .executeTakeFirst();
    },

    async listByUserId(userId: string) {
      return await db
        .selectFrom('recordings')
        .select(['id', 'file_name', 'status', 'created_at'])
        .where('user_id', '=', userId)
        .execute();
    },
  };
}

export type RecordingRepository = ReturnType<typeof createRecordingRepository>;
