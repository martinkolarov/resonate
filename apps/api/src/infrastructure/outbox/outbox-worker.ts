import type { OutboxMessageRepository } from './outbox-message.repository.js';
import { setTimeout as sleep } from 'node:timers/promises';

export type Dispatch = (message: unknown) => Promise<void>;

export function createOutboxWorker(outboxMessages: OutboxMessageRepository) {
  return {
    async work(dispatch: Dispatch, signal: AbortSignal) {
      while (!signal.aborted) {
        const messages = await outboxMessages.claimAvailable(1);

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
            await outboxMessages.markProcessed(id);
          } catch (error: unknown) {
            if (error instanceof Error) {
              await outboxMessages.scheduleRetry(id, new Date(Date.now() + 1000 * 60 * 2), error);
            }
          }
        }
      }
    },
  };
}

export type OutboxWorker = ReturnType<typeof createOutboxWorker>;
