import { logger } from './infrastructure/observability/logger.js';
import { createOutboxWorker } from './infrastructure/outbox/outbox-worker.js';
import * as Sentry from '@sentry/node';
import {
  createRecordingOutboxHandlers,
  createRecordingOutboxPublisher,
} from './features/recordings/outbox.js';
import { createRecordingPipeline } from './features/recordings/processing/pipeline.js';
import { createInfrastructure } from './infrastructure/infrastructure.js';
import { createAuthOutboxHandlers } from './features/auth/outbox.js';
import { createResendEmailSender } from './infrastructure/email/resend-email-sender.js';
import env from './env.js';
import { registerGracefulShutdown } from './lib/graceful-shutdown.js';

const workerLogger = logger.child({ component: 'worker' });

const infrastructure = createInfrastructure();
await infrastructure.connect();

const emailSender = createResendEmailSender(env.RESEND_API_KEY);
const recordingOutbox = createRecordingOutboxPublisher(infrastructure.outboxMessages);
const recordingPipeline = createRecordingPipeline(infrastructure, recordingOutbox);

const outboxWorker = createOutboxWorker(infrastructure.outboxMessages);

registerGracefulShutdown({
  name: 'Worker',
  logger: workerLogger,
  steps: [
    { name: 'outbox worker', close: outboxWorker.close },
    { name: 'recording pipeline', close: recordingPipeline.close },
    { name: 'infrastructure', close: infrastructure.close },
    { name: 'Sentry', close: () => Sentry.close(2_000) },
  ],
});

await Promise.all([
  outboxWorker.run({
    ...createAuthOutboxHandlers(emailSender),
    ...createRecordingOutboxHandlers(recordingPipeline),
  }),
  recordingPipeline.run(),
]);
