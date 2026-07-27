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
import { EmailSender } from '@/ports.js';
import {
  generateEmailVerificationToken,
  generateSessionToken,
  hashToken,
} from '@/features/auth/lib/tokens.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly emailSender: EmailSender
  ) {}

  async register({ name, email, password }: SignUpRequest) {
    const salt = generateSalt();
    const hashedPassword = await hashPassword(password, salt);

    const user = await this.users.create({
      name,
      email,
      password: `${hashedPassword.toString('base64')}:${salt.toString('base64')}`,
    });

    if (!user) {
      throw new ApiError('EMAIL_ALREADY_REGISTERED');
    }

    await this.sendEmailVerification(user);

    const { token, expiresAt } = await this.startSession(user.id);

    return {
      token,
      expiresAt,
    };
  }

  private async sendEmailVerification(user: { id: string; name: string; email: string }) {
    const token = generateEmailVerificationToken();
    await this.emailVerifications.upsert(user.id, hashToken(token));
    await this.emailSender.send(user.email, 'Hello there', `<h1>${token}</h1>`);
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

    const { token, expiresAt } = await this.startSession(user.id);

    return { token, expiresAt };
  }

  private async startSession(userId: string) {
    const token = generateSessionToken();
    const hashedToken = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.sessions.create({
      userId,
      hashedToken,
      expiresAt,
    });

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
