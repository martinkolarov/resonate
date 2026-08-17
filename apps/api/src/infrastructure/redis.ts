import env from '@/env.js';
import { Redis } from 'ioredis';
import { logger } from './observability/logger.js';

const redisLogger = logger.child({ component: 'redis' });

export const redis = new Redis({
  port: env.REDIS_PORT,
  host: env.REDIS_HOST,
  maxRetriesPerRequest: null,
});

redis.on('error', error => {
  redisLogger.error({ err: error }, 'Unexpected Redis error');
});
