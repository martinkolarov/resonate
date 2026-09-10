import type { OutboxMessageRepository } from './outbox-message.repository.js';
import { setTimeout as sleep } from 'node:timers/promises';

export type OutboxHandlers = {
  [key: string]: (message: { id: string; type: string; payload: unknown }) => Promise<void>;
};

export function createOutboxWorker(outboxMessages: OutboxMessageRepository) {
  let handlePromise: Promise<void> | undefined;
  const abortController = new AbortController();
  async function handle(outboxHandlers: OutboxHandlers) {
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
          const handler = outboxHandlers[type];
          if (!handler) {
            throw new Error(`Invalid message type: ${type}`);
          }
          await handler({
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
    async run(outboxHandlers: OutboxHandlers) {
      if (handlePromise) {
        throw new Error('Outbox worker is already running');
      }
      handlePromise = handle(outboxHandlers);
      await handlePromise;
    },
    async close() {
      abortController.abort();
      await handlePromise;
    },
  };
}

export type OutboxWorker = ReturnType<typeof createOutboxWorker>;
