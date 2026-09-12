import type { Logger } from 'pino';

type ShutdownStep = {
  name: string;
  close: () => Promise<unknown> | unknown;
};

type GracefulShutdownOptions = {
  name: string;
  logger: Pick<Logger, 'error' | 'info'>;
  steps: readonly ShutdownStep[];
  timeoutMs?: number;
};

export function registerGracefulShutdown({
  name,
  logger,
  steps,
  timeoutMs = 30_000,
}: GracefulShutdownOptions) {
  let shutdownPromise: Promise<void> | undefined;

  async function shutdown(signal: NodeJS.Signals) {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = performShutdown(signal);
    return shutdownPromise;
  }

  async function performShutdown(signal: NodeJS.Signals) {
    logger.info({ signal }, `${name} shutting down`);

    const timeout = setTimeout(() => {
      logger.error({ timeoutMs }, `${name} shutdown timed out`);
      process.exit(1);
    }, timeoutMs);

    let failed = false;

    for (const step of steps) {
      try {
        await step.close();
      } catch (error: unknown) {
        failed = true;
        logger.error({ err: error, step: step.name }, `${name} shutdown step failed`);
      }
    }

    process.exitCode = failed ? 1 : 0;

    if (failed) {
      timeout.unref();
      logger.error(`${name} shutdown completed with errors`);
      return;
    }

    clearTimeout(timeout);
    logger.info(`${name} shutdown complete`);
  }

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
