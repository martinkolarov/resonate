import type { OutboxMessageRepository } from './outbox-message.repository.js';
import { setTimeout as sleep } from 'node:timers/promises';

export type Dispatch = (message: unknown) => Promise<void>;

export function createOutboxWorker(outboxMessages: OutboxMessageRepository) {
  let loopPromise: Promise<void> | undefined;
  const abortController = new AbortController();
  async function loop(dispatch: Dispatch) {
    while (!abortController.signal.aborted) {
      const messages = await outboxMessages.claimAvailable(1);

      if (messages.length === 0) {
        try {
          await sleep(10_000, undefined, { signal: abortController.signal });
        } catch (error: unknown) {
          if (abortController.signal.aborted) {
            return;
          }
          throw error;
        }
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
  }
  return {
    async run(dispatch: Dispatch) {
      if (loopPromise) {
        throw new Error('Outbox worker is already running');
      }
      loopPromise = loop(dispatch);
      await loopPromise;
    },
    async close() {
      abortController.abort();
      await loopPromise;
    },
  };
}

export type OutboxWorker = ReturnType<typeof createOutboxWorker>;
