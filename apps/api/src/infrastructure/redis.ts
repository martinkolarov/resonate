import { Redis } from 'ioredis';
import { logger } from './observability/logger.js';

const redisLogger = logger.child({ component: 'redis' });

type RedisConfig = {
  url: string;
};

export function createRedis({ url }: RedisConfig) {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  client.on('error', error => {
    redisLogger.error({ err: error }, 'Unexpected Redis error');
  });

  return {
    client,

    async connect() {
      await client.connect();
      await client.ping();
      redisLogger.info('Redis connected');
    },

    async close() {
      if (client.status === 'ready') {
        await client.quit();
      } else {
        client.disconnect();
      }
      redisLogger.info('Redis connection closed');
    },
  };
}

export type RedisConnection = ReturnType<typeof createRedis>;
