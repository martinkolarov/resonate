import { parseCookie } from 'cookie';
import type { NextFunction, Request, Response } from 'express';
import { db } from '@/infrastructure/postgres.js';
import { ApiError } from '@/lib/errors.js';
import { hashSessionToken } from '../lib/session-token.js';
import { SessionRepository } from '../repositories/session.repository.js';

const sessions = new SessionRepository(db);

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookie(req.headers.cookie ?? '');
    const token = cookies['session-id'];

    if (!token) {
      throw new ApiError('UNAUTHENTICATED');
    }

    const hashedToken = hashSessionToken(token);
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
