import express, { type Express } from 'express';
import { createAuthModule } from '@/features/auth/auth.module.js';
import { createRecordingModule } from '@/features/recordings/recording.module.js';
import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { ApiError, ValidationError } from '@/lib/errors.js';
import * as Sentry from '@sentry/node';
import { errorHandler } from '@/middleware/error-handler.js';

export function createApp(infrastructure: Infrastructure): Express {
  const auth = createAuthModule({ infrastructure });
  const recordings = createRecordingModule({
    infrastructure,
    requireSession: auth.requireSession,
  });

  const app = express();

  app.use(express.json());

  app.use('/auth', auth.router);
  app.use('/recordings', recordings.router);

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
