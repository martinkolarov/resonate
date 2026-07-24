import crypto from 'node:crypto';
import type { SignInRequest, SignUpRequest } from '@resonate/contracts';
import { ApiError } from '@/lib/errors.js';
import { hashPassword, verifyPassword } from './lib/password-hashing.js';
import { generateSessionToken, hashSessionToken } from './lib/session-token.js';
import type { SessionRepository } from './repositories/session.repository.js';
import type { UserRepository } from './repositories/user.repository.js';
import { EmailVerificationRepository } from './repositories/email-verification.repository.js';
import { EmailSender } from '@/ports.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly emailVerifications: EmailVerificationRepository,
    private readonly emailSender: EmailSender
  ) {}

  async register({ name, email, password }: SignUpRequest): Promise<void> {
    const salt = crypto.randomBytes(16);
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
  }

  async sendEmailVerification(user: { id: string; name: string; email: string }) {
    const token = crypto.randomBytes(16).toString('base64url');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    await this.emailVerifications.upsert(user.id, hashedToken);
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

    const token = generateSessionToken();
    const hashedToken = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.sessions.create({
      userId: user.id,
      hashedToken,
      expiresAt,
    });

    return { token, expiresAt };
  }
}
