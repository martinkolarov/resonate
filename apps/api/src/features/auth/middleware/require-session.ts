import { parseCookie } from 'cookie';
import type { RequestHandler } from 'express';
import type { AuthService } from '@/features/auth/auth.service.js';
import { ApiError } from '@/lib/errors.js';

export function createRequireSession(
  authService: Pick<AuthService, 'authenticateSession'>
): RequestHandler {
  return async (req, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies['session-id'];

      if (!token) {
        throw new ApiError('UNAUTHENTICATED');
      }

      res.locals.user = await authService.authenticateSession(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
