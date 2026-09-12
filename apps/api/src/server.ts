import { createApp } from '@/app.js';
import { logger } from '@/infrastructure/observability/logger.js';
import { registerGracefulShutdown } from '@/lib/graceful-shutdown.js';
import * as Sentry from '@sentry/node';
import { createInfrastructure } from './infrastructure/infrastructure.js';

const host = '127.0.0.1';
const port = 8181;

const infrastructure = createInfrastructure();
await infrastructure.connect();

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

registerGracefulShutdown({
  name: 'Server',
  logger,
  steps: [
    { name: 'HTTP server', close: closeServer },
    { name: 'infrastructure', close: infrastructure.close },
    { name: 'Sentry', close: () => Sentry.close(2_000) },
  ],
});
