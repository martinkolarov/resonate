import express, { type Express } from 'express';
import { AuthService } from '@/features/auth/auth.service.js';
import { createAuthRouter } from '@/features/auth/auth.routes.js';
import { EmailVerificationRepository } from '@/features/auth/repositories/email-verification.repository.js';
import { SessionRepository } from '@/features/auth/repositories/session.repository.js';
import { UserRepository } from '@/features/auth/repositories/user.repository.js';
import env from '@/env.js';
import { db } from '@/infrastructure/db.js';
import { ResendEmailSender } from '@/infrastructure/email/resend-email-sender.js';
import { ApiError, ValidationError } from '@/lib/errors.js';
import * as Sentry from '@sentry/node';
import { errorHandler } from '@/middleware/error-handler.js';
import type { EmailSender } from '@/ports.js';

export function createApp(): Express {
  const userRepository = new UserRepository(db);
  const sessionRepository = new SessionRepository(db);
  const emailVerificationRepository = new EmailVerificationRepository(db);
  const emailSender: EmailSender = new ResendEmailSender(env.RESEND_API_KEY);

  const authService = new AuthService(
    userRepository,
    sessionRepository,
    emailVerificationRepository,
    emailSender
  );
  const authRouter = createAuthRouter(authService);

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
