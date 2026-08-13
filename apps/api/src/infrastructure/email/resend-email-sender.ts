import type { EmailSender } from '@/ports.js';
import { Resend } from 'resend';

export function createResendEmailSender(apiKey: string) {
  const client = new Resend(apiKey);

  return {
    async send(to: string, subject: string, html: string, idempotencyKey?: string): Promise<void> {
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
  } satisfies EmailSender;
}

export type ResendEmailSender = ReturnType<typeof createResendEmailSender>;
