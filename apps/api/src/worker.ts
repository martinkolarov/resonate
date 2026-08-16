import { db } from './infrastructure/db.js';
import { logger } from './infrastructure/observability/logger.js';
import { createOutboxMessageRepository } from './infrastructure/outbox/outbox-message.repository.js';
import { createOutboxWorker } from './infrastructure/outbox/outbox-worker.js';
import z from 'zod';
import * as Sentry from '@sentry/node';
import { handleSendEmail, sendEmailMessageSchema } from './features/auth/auth.outbox.js';
import {
  handleRecordingUploaded,
  recordingUploadedSchema,
} from './features/recordings/recording.outbox.js';
import { createResendEmailSender } from './infrastructure/email/resend-email-sender.js';
import env from './env.js';
import {
  createRecordingQueue,
  createRecordingQueueWorker,
} from './features/recordings/recording.queue.js';
import { redis } from './infrastructure/redis.js';

const workerLogger = logger.child({ component: 'worker' });

const emailSender = createResendEmailSender(env.RESEND_API_KEY);

const recordingQueue = createRecordingQueue(redis);
const recordingQueueWorker = createRecordingQueueWorker(redis);

const outboxMessages = createOutboxMessageRepository(db);
const outboxWorker = createOutboxWorker(outboxMessages);

const outboxMessageSchema = z.discriminatedUnion('type', [
  sendEmailMessageSchema,
  recordingUploadedSchema,
]);

async function handleOutboxMessage(message: unknown) {
  const parsedMessage = outboxMessageSchema.parse(message);

  switch (parsedMessage.type) {
    case 'send-email':
      await handleSendEmail(parsedMessage, emailSender);
      break;
    case 'recording-uploaded':
      await handleRecordingUploaded(parsedMessage, recordingQueue);
      break;
  }
}

let isShuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    workerLogger.info({ signal }, 'Worker shutting down');

    await outboxWorker.close();
    await recordingQueueWorker.close();
    await recordingQueue.close();
    await redis.quit();
    await db.destroy();
    await Sentry.close(2_000);

    workerLogger.info('Worker shutdown complete');
  } catch (error) {
    workerLogger.error({ err: error }, 'Worker failed to shut down');
    process.exitCode = 1;
  }
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

await Promise.all([outboxWorker.run(handleOutboxMessage), recordingQueueWorker.run()]);
