import { parseCookie } from 'cookie';
import type { NextFunction, Request, Response } from 'express';
import { db } from '@/infrastructure/db.js';
import { ApiError } from '@/lib/errors.js';
import { SessionRepository } from '@/features/auth/repositories/session.repository.js';
import { hashToken } from '@/features/auth/lib/tokens.js';

const sessions = new SessionRepository(db);

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookie(req.headers.cookie ?? '');
    const token = cookies['session-id'];

    if (!token) {
      throw new ApiError('UNAUTHENTICATED');
    }

    const hashedToken = hashToken(token);
    const user = await sessions.findUserByValidTokenHash(hashedToken);

    if (!user) {
      throw new ApiError('UNAUTHENTICATED');
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
