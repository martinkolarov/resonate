import { createApp } from '@/app.js';
import { db } from '@/infrastructure/db.js';
import { logger } from '@/infrastructure/observability/logger.js';
import * as Sentry from '@sentry/node';

const host = '127.0.0.1';
const port = 8181;

const app = createApp();
const server = app.listen(port, host, () => {
  logger.info({ host, port }, 'Server started');
});

function closeServer() {
  return new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    logger.info('Server is shutting down');
    await closeServer();
    await db.destroy();
    logger.info('Server shut down successfully');
    process.exitCode = 0;
  } catch (error) {
    logger.error({ error }, 'Server failed to shut down');
    process.exitCode = 1;
  } finally {
    await Sentry.close(2_000);
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
