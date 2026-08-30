import type { EmailSender } from '@/infrastructure/email/email-sender.js';
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

type SendVerificationEmailMessage = z.infer<typeof sendVerificationEmailMessageSchema>;

export async function handleSendVerificationEmail(
  message: SendVerificationEmailMessage,
  emailSender: EmailSender
) {
  await emailSender.send(
    message.payload.to,
    message.payload.subject,
    message.payload.html,
    message.id
  );
}
