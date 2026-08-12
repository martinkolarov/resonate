import { DB } from '@/types/db.generated.types.js';
import { Kysely, Transaction } from 'kysely';

export class RecordingRepository {
  constructor(private readonly db: Kysely<DB>) {}

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
    return await this.db
      .insertInto('recordings')
      .values({
        user_id: userId,
        object_key: objectKey,
        file_name: fileName,
        provider,
      })
      .returning('id')
      .executeTakeFirst();
  }

  async getById(id: string) {
    return await this.db
      .selectFrom('recordings')
      .selectAll()
      .where('id', '=', id)
      .limit(1)
      .executeTakeFirst();
  }

  async markUploaded(id: string, trx?: Transaction<DB>) {
    return await (trx ?? this.db)
      .updateTable('recordings')
      .set({ status: 'uploaded' })
      .where('status', '=', 'uploading')
      .where('id', '=', id)
      .returning(['id'])
      .executeTakeFirst();
  }

  async listByUserId(userId: string) {
    return await this.db
      .selectFrom('recordings')
      .select(['id', 'file_name', 'status', 'created_at'])
      .where('user_id', '=', userId)
      .execute();
  }
}
