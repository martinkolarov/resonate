import type { EmailSender } from '@/infrastructure/email/email-sender.js';
import z from 'zod';

export const sendEmailMessageSchema = z.object({
  id: z.string(),
  type: z.literal('send-email'),
  payload: z.object({
    to: z.string(),
    subject: z.string(),
    html: z.string(),
  }),
});

type SendEmailMessage = z.infer<typeof sendEmailMessageSchema>;

export async function handleSendEmail(message: SendEmailMessage, emailSender: EmailSender) {
  await emailSender.send(
    message.payload.to,
    message.payload.subject,
    message.payload.html,
    message.id
  );
}
