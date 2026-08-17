import { createApp } from '@/app.js';
import { logger } from '@/infrastructure/observability/logger.js';
import * as Sentry from '@sentry/node';
import { createInfrastructure } from './infrastructure/infrastructure.js';

const host = '127.0.0.1';
const port = 8181;

const infrastructure = createInfrastructure();
const app = createApp(infrastructure);
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
async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Server shutting down');

  try {
    await closeServer();
    await infrastructure.redis.quit();
    await infrastructure.db.destroy();
    await Sentry.close(2_000);
    logger.info('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Server shutdown failed');
    process.exit(1);
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
