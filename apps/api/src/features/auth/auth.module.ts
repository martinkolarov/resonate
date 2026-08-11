import { Router, type RequestHandler, type Response } from 'express';
import { signInRequestSchema, signUpRequestSchema } from '@resonate/contracts';
import { AuthService } from '@/features/auth/auth.service.js';
import { createRequireSession } from '@/features/auth/middleware/require-session.js';
import { EmailVerificationRepository } from '@/features/auth/repositories/email-verification.repository.js';
import { SessionRepository } from '@/features/auth/repositories/session.repository.js';
import { UserRepository } from '@/features/auth/repositories/user.repository.js';
import type { Infrastructure } from '@/infrastructure/create-infrastructure.js';
import { ValidationError } from '@/lib/errors.js';

type AuthModuleDependencies = Pick<Infrastructure, 'db' | 'outboxMessages' | 'transactionRunner'>;

type AuthModule = {
  router: Router;
  requireSession: RequestHandler;
};

function sendSessionResponse(
  res: Response,
  { token, expiresAt }: { token: string; expiresAt: Date }
) {
  return res
    .cookie('session-id', token, {
      expires: expiresAt,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    .status(204)
    .end();
}

export function createAuthModule({
  db,
  outboxMessages,
  transactionRunner,
}: AuthModuleDependencies): AuthModule {
  const users = new UserRepository(db);
  const sessions = new SessionRepository(db);
  const emailVerifications = new EmailVerificationRepository(db);
  const service = new AuthService(
    transactionRunner,
    users,
    sessions,
    emailVerifications,
    outboxMessages
  );
  const requireSession = createRequireSession(service);
  const router = Router();

  router.post('/register', async (req, res) => {
    const { success, data, error } = signUpRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await service.register(data);
    return sendSessionResponse(res, session);
  });

  router.post('/login', async (req, res) => {
    const { success, error, data } = signInRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await service.login(data);
    return sendSessionResponse(res, session);
  });

  router.get('/session', requireSession, (_req, res) => {
    return res.json({ user: res.locals.user });
  });

  return {
    router,
    requireSession,
  };
}
