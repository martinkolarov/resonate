import { Router } from 'express';
import { signInRequestSchema, signUpRequestSchema } from '@resonate/contracts';
import { ValidationError } from '@/lib/errors.js';
import { db } from '@/infrastructure/postgres.js';
import { AuthService } from './auth.service.js';
import { SessionRepository } from './repositories/session.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { requireSession } from './middleware/require-session.js';

export const authRouter: Router = Router();
const userRepository = new UserRepository(db);
const sessionRepository = new SessionRepository(db);
const authService = new AuthService(userRepository, sessionRepository);

authRouter.post('/register', async (req, res) => {
  const { success, data, error } = signUpRequestSchema.safeParse(req.body);
  if (!success) {
    throw new ValidationError(error);
  }
  await authService.register(data);
  res.status(204).end();
});

authRouter.post('/login', async (req, res) => {
  const { success, data, error } = signInRequestSchema.safeParse(req.body);
  if (!success) {
    throw new ValidationError(error);
  }
  const session = await authService.login(data);

  return res
    .cookie('session-id', session.token, {
      expires: session.expiresAt,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    .status(204)
    .end();
});

authRouter.get('/session', requireSession, (_req, res) => {
  return res.json({ user: res.locals.user });
});
