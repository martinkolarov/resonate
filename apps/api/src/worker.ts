import { logger } from './infrastructure/observability/logger.js';
import { createOutboxWorker } from './infrastructure/outbox/outbox-worker.js';
import * as Sentry from '@sentry/node';
import { createrRecordingOutboxHandler } from './features/recordings/outbox.js';
import { createRecordingPipeline } from './features/recordings/processing/pipeline.js';
import { createInfrastructure } from './infrastructure/infrastructure.js';
import { createAuthOutboxHandlers } from './features/auth/outbox.js';
import { createResendEmailSender } from './infrastructure/email/resend-email-sender.js';
import env from './env.js';

const workerLogger = logger.child({ component: 'worker' });

const infrastructure = createInfrastructure();
await infrastructure.connect();

const emailSender = createResendEmailSender(env.RESEND_API_KEY);
const recordingPipeline = createRecordingPipeline(infrastructure);

const outboxWorker = createOutboxWorker(infrastructure.outboxMessages);

let isShuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    workerLogger.info({ signal }, 'Worker shutting down');

    await outboxWorker.close();
    await recordingPipeline.close();
    await infrastructure.close();
    await Sentry.close(2_000);
    workerLogger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    workerLogger.error({ err: error }, 'Worker failed to shut down');
    process.exit(1);
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await Promise.all([
  outboxWorker.run({
    ...createAuthOutboxHandlers(emailSender),
    ...createrRecordingOutboxHandler(recordingPipeline),
  }),
  recordingPipeline.run(),
]);
