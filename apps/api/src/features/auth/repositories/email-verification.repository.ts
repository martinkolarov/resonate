import type { DB } from '@/types/db.generated.types.js';
import type { Kysely, Transaction } from 'kysely';

export class EmailVerificationRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async upsert(userId: string, hashedToken: string, trx?: Transaction<DB>) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await (trx ?? this.db)
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
