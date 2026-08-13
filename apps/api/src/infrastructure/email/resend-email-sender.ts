import type { EmailSender } from './email-sender.js';
import { Resend } from 'resend';

export function createResendEmailSender(apiKey: string): EmailSender {
  const client = new Resend(apiKey);

  return {
    async send(to, subject, html, idempotencyKey) {
      const { error } = await client.emails.send(
        {
          from: 'Resonate <onboarding@resend.dev>',
          to,
          subject,
          html,
        },
        {
          idempotencyKey,
        }
      );
      if (error) {
        throw error;
      }
    },
  };
}

export type ResendEmailSender = ReturnType<typeof createResendEmailSender>;
