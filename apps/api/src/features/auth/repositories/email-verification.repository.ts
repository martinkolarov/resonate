import { DB } from '@/types/db.generated.types.js';
import { Kysely } from 'kysely';

export class EmailVerificationRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async upsert(userId: string, hashedToken: string) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await this.db
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
