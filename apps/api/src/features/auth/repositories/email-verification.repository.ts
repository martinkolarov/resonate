import type { DB } from '@/types/db.generated.types.js';
import type { Kysely } from 'kysely';

export class EmailVerificationRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async upsert(userId: string, hashedToken: string, executor: Kysely<DB> = this.db) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await executor
      .insertInto('email_verifications')
      .values({
        user_id: userId,
        hashed_token: hashedToken,
        expires_at: expiresAt,
      })
      .onConflict(conflict => {
        return conflict.column('user_id').doUpdateSet({
          hashed_token: hashedToken,
          expires_at: expiresAt,
        });
      })
      .executeTakeFirstOrThrow();
  }
}
