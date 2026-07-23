import express, { type ErrorRequestHandler, type Express } from 'express';
import { authRouter } from '@/features/auth/auth.routes.js';
import { ApiError, ValidationError } from '@/lib/errors.js';

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error instanceof ApiError || error instanceof ValidationError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  console.error('Unhandled request error', error);

  return res.status(500).json(new ApiError('INTERNAL_SERVER_ERROR').toJSON());
};

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ message: 'Hello' });
  });
  app.use('/auth', authRouter);

  app.use(errorHandler);

  return app;
}
