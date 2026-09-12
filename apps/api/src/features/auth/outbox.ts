import type { EmailSender } from '@/infrastructure/email/email-sender.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { DB } from '@/types/db.generated.types.js';
import type { Transaction } from 'kysely';
import z from 'zod';

export const sendVerificationEmailMessageSchema = z.object({
  id: z.string(),
  type: z.literal('auth.send-verification-email'),
  payload: z.object({
    to: z.string(),
    subject: z.string(),
    html: z.string(),
  }),
});

export type SendVerificationEmailMessage = z.infer<typeof sendVerificationEmailMessageSchema>;

export function createAuthOutboxPublisher(outboxMessages: OutboxMessageRepository) {
  return {
    publishSendVerificationEmail(
      payload: SendVerificationEmailMessage['payload'],
      trx: Transaction<DB>
    ) {
      return outboxMessages.enqueue('auth.send-verification-email', payload, trx);
    },
  };
}

export type AuthOutboxPublisher = ReturnType<typeof createAuthOutboxPublisher>;

export function createAuthOutboxHandlers(emailSender: EmailSender) {
  return {
    'auth.send-verification-email': async (message: unknown) => {
      const { id, payload } = sendVerificationEmailMessageSchema.parse(message);
      await emailSender.send(payload.to, payload.subject, payload.html, id);
    },
  };
}
