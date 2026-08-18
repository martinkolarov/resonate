import type { Kysely, Selectable, Transaction } from 'kysely';
import type { DB } from '@/types/db.generated.types.js';

export function createUserRepository(postgres: Kysely<DB>) {
  return {
    async findByEmail(email: string): Promise<Selectable<DB['users']> | undefined> {
      return postgres
        .selectFrom('users')
        .selectAll()
        .where('email', '=', email)
        .limit(1)
        .executeTakeFirst();
    },

    async create(
      { name, email, password }: { name: string; email: string; password: string },
      trx?: Transaction<DB>
    ) {
      return await (trx ?? postgres)
        .insertInto('users')
        .values({
          name,
          email,
          password,
        })
        .returning(['id', 'name', 'email'])
        .onConflict(conflict => conflict.constraint('users_email_provider_unique').doNothing())
        .executeTakeFirst();
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
