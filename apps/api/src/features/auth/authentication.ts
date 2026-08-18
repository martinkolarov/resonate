import type { SignInRequest, SignUpRequest } from '@resonate/contracts';
import { ApiError } from '@/lib/errors.js';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
} from '@/features/auth/lib/password-hashing.js';
import type { SessionRepository } from '@/features/auth/repositories/session.repository.js';
import type { UserRepository } from '@/features/auth/repositories/user.repository.js';
import type { EmailVerificationRepository } from '@/features/auth/repositories/email-verification.repository.js';
import {
  generateEmailVerificationToken,
  generateSessionToken,
  hashToken,
} from '@/features/auth/lib/tokens.js';
import type { Transaction } from 'kysely';
import type { DB } from '@/types/db.generated.types.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

type AuthenticationDeps = {
  emailVerifications: EmailVerificationRepository;
  outboxMessages: OutboxMessageRepository;
  sessions: SessionRepository;
  transactionRunner: TransactionRunner;
  users: UserRepository;
};

export function createAuthentication({
  emailVerifications,
  outboxMessages,
  sessions,
  transactionRunner,
  users,
}: AuthenticationDeps) {
  async function startSession(userId: string, trx?: Transaction<DB>) {
    const token = generateSessionToken();
    const hashedToken = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await sessions.create(
      {
        userId,
        hashedToken,
        expiresAt,
      },
      trx
    );

    return {
      token,
      expiresAt,
    };
  }

  return {
    async register({ name, email, password }: SignUpRequest) {
      const salt = generateSalt();
      const hashedPassword = await hashPassword(password, salt);

      return transactionRunner.run(async trx => {
        const user = await users.create(
          {
            name,
            email,
            password: `${hashedPassword.toString('base64')}:${salt.toString('base64')}`,
          },
          trx
        );

        if (!user) {
          throw new ApiError('EMAIL_ALREADY_REGISTERED');
        }

        const emailVerificationToken = generateEmailVerificationToken();

        await emailVerifications.upsert(user.id, hashToken(emailVerificationToken), trx);

        await outboxMessages.enqueue(
          'send-email',
          {
            to: user.email,
            subject: 'Verify your email',
            html: `<h1>${emailVerificationToken}</h1>`,
          },
          trx
        );

        return startSession(user.id, trx);
      });
    },

    async login({ email, password }: SignInRequest): Promise<{ token: string; expiresAt: Date }> {
      const user = await users.findByEmail(email);

      if (!user) {
        throw new ApiError('INVALID_CREDENTIALS');
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        throw new ApiError('INVALID_CREDENTIALS');
      }

      return startSession(user.id);
    },

    async authenticateWithSessionToken(token: string) {
      const user = await sessions.findUserByValidTokenHash(hashToken(token));

      if (!user) {
        throw new ApiError('UNAUTHENTICATED');
      }

      return user;
    },
  };
}

export type Authentication = ReturnType<typeof createAuthentication>;
