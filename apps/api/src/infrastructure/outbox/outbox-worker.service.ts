import { OutboxMessageRepository } from './outbox-message.repository.js';
import { setTimeout as sleep } from 'node:timers/promises';

export type Dispatch = (message: unknown) => Promise<void>;

export class OutboxWorkerService {
  constructor(private readonly outboxMessages: OutboxMessageRepository) {}

  async work(dispatch: Dispatch, signal: AbortSignal) {
    while (!signal.aborted) {
      const messages = await this.outboxMessages.claimAvailable(1);

      if (messages.length === 0) {
        await sleep(10_000, undefined, { signal });
        continue;
      }

      for (const { id, type, payload } of messages) {
        try {
          await dispatch({
            id,
            type,
            payload: JSON.parse(payload),
          });
          await this.outboxMessages.markProcessed(id);
        } catch (error: unknown) {
          if (error instanceof Error) {
            await this.outboxMessages.scheduleRetry(id, new Date(Date.now() + 1000 * 120), error);
          }
        }
      }
    }
  }
}
