import crypto from 'node:crypto';
import type { SignInRequest, SignUpRequest } from '@resonate/contracts';
import { ApiError } from '@/lib/errors.js';
import { hashPassword, verifyPassword } from './lib/password-hashing.js';
import { generateSessionToken, hashSessionToken } from './lib/session-token.js';
import type { SessionRepository } from './repositories/session.repository.js';
import type { UserRepository } from './repositories/user.repository.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository
  ) {}

  async register({ name, email, password }: SignUpRequest): Promise<void> {
    const salt = crypto.randomBytes(16);
    const hashedPassword = await hashPassword(password, salt);

    const wasCreated = await this.users.create({
      name,
      email,
      password: `${hashedPassword.toString('base64')}:${salt.toString('base64')}`,
    });

    if (!wasCreated) {
      throw new ApiError('EMAIL_ALREADY_REGISTERED');
    }
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
