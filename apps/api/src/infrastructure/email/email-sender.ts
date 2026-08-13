export interface EmailSender {
  send(to: string, subject: string, html: string, idempotencyKey: string): Promise<void>;
}
