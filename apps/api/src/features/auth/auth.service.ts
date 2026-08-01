import type { SignInRequest, SignUpRequest } from '@resonate/contracts';
import { ApiError } from '@/lib/errors.js';
import {
  generateSalt,
  hashPassword,
  verifyPassword,
} from '@/features/auth/lib/password-hashing.js';
import type { SessionRepository } from '@/features/auth/repositories/session.repository.js';
import type { UserRepository } from '@/features/auth/repositories/user.repository.js';
import { EmailVerificationRepository } from '@/features/auth/repositories/email-verification.repository.js';
import {
  generateEmailVerificationToken,
  generateSessionToken,
  hashToken,
} from '@/features/auth/lib/tokens.js';
import { db } from '@/infrastructure/db.js';
import type { Kysely } from 'kysely';
import type { DB } from '@/types/db.generated.types.js';
import { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly outboxMessages: OutboxMessageRepository
  ) {}

  async register({ name, email, password }: SignUpRequest) {
    const salt = generateSalt();
    const hashedPassword = await hashPassword(password, salt);

    return db.transaction().execute(async trx => {
      const user = await this.users.create(
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

      await this.emailVerifications.upsert(user.id, hashToken(emailVerificationToken), trx);

      await this.outboxMessages.enqueue(trx, 'send-email', {
        to: user.email,
        subject: 'Verify your email',
        html: `<h1>${emailVerificationToken}</h1>`,
      });

      return this.startSession(user.id, trx);
    });
  }

  async login({ email, password }: SignInRequest): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new ApiError('INVALID_CREDENTIALS');
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      throw new ApiError('INVALID_CREDENTIALS');
    }

    return this.startSession(user.id);
  }

  private async startSession(userId: string, executor?: Kysely<DB>) {
    const token = generateSessionToken();
    const hashedToken = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.sessions.create(
      {
        userId,
        hashedToken,
        expiresAt,
      },
      executor
    );

    return {
      token,
      expiresAt,
    };
  }

  async authenticateSession(token: string) {
    const user = await this.sessions.findUserByValidTokenHash(hashToken(token));

    if (!user) {
      throw new ApiError('UNAUTHENTICATED');
    }

    return user;
  }
}
