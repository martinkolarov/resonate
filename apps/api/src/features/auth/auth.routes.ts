import { Router, type RequestHandler, type Response } from 'express';
import { signInRequestSchema, signUpRequestSchema } from '@resonate/contracts';
import { ValidationError } from '@/lib/errors.js';
import type { AuthService } from '@/features/auth/auth.service.js';
import { createRequireSession } from '@/features/auth/middleware/require-session.js';

const getSession: RequestHandler = (_req, res) => {
  res.json({ user: res.locals.user });
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

export function createAuthRouter(
  authService: Pick<AuthService, 'register' | 'login' | 'authenticateSession'>
): Router {
  const authRouter = Router();

  authRouter.post('/register', async (req, res) => {
    const { success, data, error } = signUpRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await authService.register(data);
    return sendSessionResponse(res, session);
  });

  authRouter.post('/login', async (req, res) => {
    const { success, data, error } = signInRequestSchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const session = await authService.login(data);
    return sendSessionResponse(res, session);
  });

  authRouter.get('/session', createRequireSession(authService), getSession);

  return authRouter;
}
