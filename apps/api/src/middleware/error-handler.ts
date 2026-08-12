import type { NextFunction, Request, Response } from 'express';
import { ApiError, ValidationError } from '@/lib/errors.js';
import { logger } from '@/infrastructure/observability/logger.js';

const httpLogger = logger.child({ component: 'http' });

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ValidationError || (error instanceof ApiError && error.statusCode < 500)) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  httpLogger.error(
    {
      err: error,
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
