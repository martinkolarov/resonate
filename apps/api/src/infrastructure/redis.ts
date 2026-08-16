import env from '@/env.js';
import { Redis } from 'ioredis';

export const redis = new Redis({
  port: env.REDIS_PORT,
  host: env.REDIS_HOST,
});
