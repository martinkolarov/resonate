import { Router, type RequestHandler, type Response } from 'express';
import { signInRequestSchema, signUpRequestSchema } from '@resonate/contracts';
import { createAuthentication } from '@/features/auth/authentication.js';
import { createRequireSession } from '@/features/auth/middleware/require-session.js';
import { createEmailVerificationRepository } from '@/features/auth/repositories/email-verification.repository.js';
import { createSessionRepository } from '@/features/auth/repositories/session.repository.js';
import { createUserRepository } from '@/features/auth/repositories/user.repository.js';
import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { ValidationError } from '@/lib/errors.js';

type AuthRoutesDeps = {
  infrastructure: Pick<Infrastructure, 'postgres' | 'outboxMessages' | 'transactionRunner'>;
};

type AuthRoutes = {
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

export function createAuthRoutes({ infrastructure }: AuthRoutesDeps): AuthRoutes {
  const { postgres, outboxMessages, transactionRunner } = infrastructure;
  const emailVerifications = createEmailVerificationRepository(postgres);
  const sessions = createSessionRepository(postgres);
  const users = createUserRepository(postgres);
  const authentication = createAuthentication({
    emailVerifications,
    outboxMessages,
    sessions,
    transactionRunner,
    users,
  });
  const requireSession = createRequireSession(authentication);
  const router = Router();

  router.post('/register', async (req, res) => {
    const { success, data, error } = signUpRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await authentication.register(data);
    return sendSessionResponse(res, session);
  });

  router.post('/login', async (req, res) => {
    const { success, error, data } = signInRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await authentication.login(data);
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
