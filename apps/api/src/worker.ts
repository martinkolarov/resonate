import env from './env.js';
import { db } from './infrastructure/db.js';
import { createResendEmailSender } from './infrastructure/email/resend-email-sender.js';
import { logger } from './infrastructure/observability/logger.js';
import { createOutboxMessageRepository } from './infrastructure/outbox/outbox-message.repository.js';
import { createOutboxWorkerService } from './infrastructure/outbox/outbox-worker.service.js';
import z from 'zod';
import * as Sentry from '@sentry/node';

const workerLogger = logger.child({ component: 'worker' });

const sendEmailMessageSchema = z.object({
  id: z.string(),
  type: z.literal('send-email'),
  payload: z.object({
    to: z.string(),
    subject: z.string(),
    html: z.string(),
  }),
});

type SendEmailMessage = z.infer<typeof sendEmailMessageSchema>;

const messageSchema = z.discriminatedUnion('type', [sendEmailMessageSchema]);

const outboxMessages = createOutboxMessageRepository(db);
const outboxWorkerService = createOutboxWorkerService(outboxMessages);

const emailSender = createResendEmailSender(env.RESEND_API_KEY);

async function handleSendEmail(message: SendEmailMessage) {
  await emailSender.send(
    message.payload.to,
    message.payload.subject,
    message.payload.html,
    message.id
  );
}

async function dispatch(message: unknown) {
  const parsedMessage = messageSchema.parse(message);

  switch (parsedMessage.type) {
    case 'send-email':
      await handleSendEmail(parsedMessage);
      break;
  }
}

const abortController = new AbortController();
let isShuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try {
    workerLogger.info({ signal }, 'Worker shutting down');

    abortController.abort();
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

await outboxWorkerService.work(dispatch, abortController.signal);
