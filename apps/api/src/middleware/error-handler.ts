import type { NextFunction, Request, Response } from 'express';
import { logger } from '@/infrastructure/logger.js';
import { ApiError, ValidationError } from '@/lib/errors.js';

const errorLogger = logger.child({ component: 'error-handler' });

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ValidationError || (error instanceof ApiError && error.statusCode < 500)) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  errorLogger.error(
    {
      error,
      request: {
        method: req.method,
        path: req.path,
      },
    },
    'Request failed'
  );

  const responseError = error instanceof ApiError ? error : new ApiError('INTERNAL_SERVER_ERROR');

  return res.status(responseError.statusCode).json(responseError.toJSON());
}
