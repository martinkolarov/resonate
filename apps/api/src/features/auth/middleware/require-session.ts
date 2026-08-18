import { parseCookie } from 'cookie';
import type { RequestHandler } from 'express';
import type { Authentication } from '@/features/auth/authentication.js';
import { ApiError } from '@/lib/errors.js';

export function createRequireSession(
  authentication: Pick<Authentication, 'authenticateWithSessionToken'>
): RequestHandler {
  return async (req, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies['session-id'];

      if (!token) {
        throw new ApiError('UNAUTHENTICATED');
      }

      res.locals.user = await authentication.authenticateWithSessionToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
