import pino from 'pino';
import env from '@/env.js';

export const logger = pino({
  name: 'resonate-api',
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'token',
      'hashedToken',
      'hashed_token',
      'authorization',
      'cookie',
      'headers.authorization',
      'headers.cookie',
      'body.password',
      'body.token',
      'payload.password',
      'payload.token',
      'user.password',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
    ],
  },
});
