import type { EmailSender } from '@/infrastructure/email/email-sender.js';
import z from 'zod';

export const sendVerificationEmailPayloadSchema = z.object({
  to: z.string(),
  subject: z.string(),
  html: z.string(),
});

export function createAuthOutboxHandlers(emailSender: EmailSender) {
  return {
    'auth.send-verification-email': async (message: { id: string; payload: unknown }) => {
      const { to, subject, html } = sendVerificationEmailPayloadSchema.parse(message.payload);
      await emailSender.send(to, subject, html, message.id);
    },
  };
}
