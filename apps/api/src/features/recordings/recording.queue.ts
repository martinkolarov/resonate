import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRecordingRepository } from './repositories/recording.repository.js';
import { createRecordingService } from './recording.service.js';

type ProcessRecordingJobData = {
  recordingId: string;
};
type RecordingJobData = ProcessRecordingJobData;
type RecordingJobName = 'process-recording';

export function createRecordingQueue(redis: Redis) {
  const queue = new Queue<RecordingJobData, unknown, RecordingJobName>('recordings', {
    connection: redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
    },
  });
  return {
    async enqueueProcessRecording(data: ProcessRecordingJobData, jobId: string) {
      await queue.add('process-recording', data, { jobId });
    },
    async close() {
      await queue.close();
    },
  };
}

type RecordingQueueWorkerDeps = Pick<
  Infrastructure,
  'postgres' | 'objectStorage' | 'outboxMessages' | 'redis' | 'transactionRunner'
>;

export function createRecordingQueueWorker(infrastructure: RecordingQueueWorkerDeps) {
  const recordings = createRecordingRepository(infrastructure.postgres);
  const recordingService = createRecordingService({
    objectStorage: infrastructure.objectStorage,
    outboxMessages: infrastructure.outboxMessages,
    recordings,
    transactionRunner: infrastructure.transactionRunner,
  });

  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      try {
        switch (job.name) {
          case 'process-recording': {
            const result = await recordingService.processRecording(job.data.recordingId);
            if (!result.ok) {
              throw new UnrecoverableError(result.reason);
            }
            break;
          }
        }
      } catch (error: unknown) {
        if (error instanceof UnrecoverableError) {
          await recordings.markFailed(job.data.recordingId, error.message);
        } else if (isFinalAttempt) {
          await recordings.markFailed(job.data.recordingId, 'PROCESSING_FAILED');
        }
        throw error;
      }
    },
    {
      autorun: false,
      connection: infrastructure.redis,
    }
  );

  return {
    async close() {
      await worker.close();
    },
    async run() {
      await worker.run();
    },
  };
}

export type RecordingQueue = ReturnType<typeof createRecordingQueue>;
