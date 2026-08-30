import { logger } from './infrastructure/observability/logger.js';
import { createOutboxWorker } from './infrastructure/outbox/outbox-worker.js';
import z from 'zod';
import * as Sentry from '@sentry/node';
import {
  handleRecordingUploaded,
  recordingUploadedSchema,
} from './features/recordings/recording-uploaded.js';
import { createResendEmailSender } from './infrastructure/email/resend-email-sender.js';
import env from './env.js';
import { createRecordingPipeline } from './features/recordings/processing/pipeline.js';
import { createInfrastructure } from './infrastructure/infrastructure.js';
import {
  handleSendVerificationEmail,
  sendVerificationEmailMessageSchema,
} from './features/auth/send-email.js';

const workerLogger = logger.child({ component: 'worker' });

const infrastructure = createInfrastructure();
await infrastructure.connect();

const emailSender = createResendEmailSender(env.RESEND_API_KEY);

const recordingPipeline = createRecordingPipeline(infrastructure);

const outboxWorker = createOutboxWorker(infrastructure.outboxMessages);

const outboxMessageSchema = z.discriminatedUnion('type', [
  sendVerificationEmailMessageSchema,
  recordingUploadedSchema,
]);

async function handleOutboxMessage(message: unknown) {
  const parsedMessage = outboxMessageSchema.parse(message);

  switch (parsedMessage.type) {
    case 'auth.send-verification-email':
      await handleSendVerificationEmail(parsedMessage, emailSender);
      break;
    case 'recording.uploaded':
      await handleRecordingUploaded(parsedMessage, recordingPipeline);
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

await Promise.all([outboxWorker.run(handleOutboxMessage), recordingPipeline.run()]);
