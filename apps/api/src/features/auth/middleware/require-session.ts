import { parseCookie } from 'cookie';
import type { RequestHandler } from 'express';
import type { AuthService } from '@/features/auth/auth.service.js';
import { ApiError } from '@/lib/errors.js';

export function createRequireSession(
  authService: Pick<AuthService, 'authenticateWithSessionToken'>
): RequestHandler {
  return async (req, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies['session-id'];

      if (!token) {
        throw new ApiError('UNAUTHENTICATED');
      }

      res.locals.user = await authService.authenticateWithSessionToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
