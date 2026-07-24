import type { EmailSender } from '@/ports.js';
import { Resend } from 'resend';

export class ResendEmailSender implements EmailSender {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const { error } = await this.client.emails.send({
      from: 'Resonate <onboarding@resend.dev>',
      to,
      subject,
      html,
    });
    if (error) {
      console.error(error);
      throw error;
    }
  }
}
