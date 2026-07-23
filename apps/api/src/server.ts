import { createApp } from '@/app.js';
import { db } from '@/infrastructure/postgres.js';

const app = createApp();
const server = app.listen(8181, '127.0.0.1');

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
    console.info('Server is shutting down...');
    await closeServer();
    await db.destroy();
    console.info('Server shut down successfully');
    process.exitCode = 0;
  } catch (error) {
    console.error('Server failed to shut down', error);
    process.exitCode = 1;
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
