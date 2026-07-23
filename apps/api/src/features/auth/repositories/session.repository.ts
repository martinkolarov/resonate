import type { Kysely, Selectable } from 'kysely';
import type { DB } from '@/types/db.generated.types.js';

export class SessionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async create({
    userId,
    hashedToken,
    expiresAt,
  }: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db
      .insertInto('sessions')
      .values({
        user_id: userId,
        hashed_token: hashedToken,
        expires_at: expiresAt,
      })
      .execute();
  }

  async findUserByValidTokenHash(
    hashedToken: string
  ): Promise<Pick<Selectable<DB['users']>, 'id' | 'email' | 'name'> | undefined> {
    return this.db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select(['users.id', 'users.email', 'users.name'])
      .where('sessions.hashed_token', '=', hashedToken)
      .where('sessions.expires_at', '>', new Date())
      .limit(1)
      .executeTakeFirst();
  }
}
