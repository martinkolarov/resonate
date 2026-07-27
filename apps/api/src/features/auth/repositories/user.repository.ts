import type { Kysely, Selectable } from 'kysely';
import type { DB } from '@/types/db.generated.types.js';

export class UserRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async findByEmail(email: string): Promise<Selectable<DB['users']> | undefined> {
    return this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .limit(1)
      .executeTakeFirst();
  }

  async create({ name, email, password }: { name: string; email: string; password: string }) {
    return await this.db
      .insertInto('users')
      .values({
        name,
        email,
        password,
      })
      .returning(['id', 'name', 'email'])
      .onConflict(conflict => conflict.constraint('users_email_provider_unique').doNothing())
      .executeTakeFirst();
  }
}
