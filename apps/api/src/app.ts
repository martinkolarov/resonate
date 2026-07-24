import express, { type Express } from 'express';
import { authRouter } from '@/features/auth/auth.routes.js';
import { ApiError, ValidationError } from '@/lib/errors.js';
import * as Sentry from '@sentry/node';
import { errorHandler } from '@/middleware/error-handler.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/auth', authRouter);

  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError: error => {
      if (error instanceof ValidationError) {
        return false;
      }

      if (error instanceof ApiError) {
        return error.statusCode >= 500;
      }

      return true;
    },
  });
  app.use(errorHandler);

  return app;
}
