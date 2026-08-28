import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRecordingRepository } from '../repositories/recording.repository.js';
import { createPrepareRecording } from './prepare-recording.js';
import { RecordingRejectedError, RecordingStateTransitionError } from './processing-errors.js';

type PrepareRecordingJobData = {
  recordingId: string;
};
type RecordingJobData = PrepareRecordingJobData;
type RecordingJobName = 'prepare-recording' | 'transcribe-recording' | 'summarize-recording';

export function createRecordingProcessingQueue(redis: Redis) {
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
    async enqueuePrepareRecording(data: PrepareRecordingJobData, jobId: string) {
      await queue.add('prepare-recording', data, { jobId });
    },
    async close() {
      await queue.close();
    },
  };
}

type RecordingProcessingWorkerDeps = Pick<
  Infrastructure,
  'mediaProcessor' | 'objectStorage' | 'postgres' | 'redis'
>;

export function createRecordingProcessingWorker(infrastructure: RecordingProcessingWorkerDeps) {
  const recordings = createRecordingRepository(infrastructure.postgres);
  const prepareRecording = createPrepareRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    recordings,
  });

  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      try {
        switch (job.name) {
          case 'prepare-recording': {
            await prepareRecording(job.data.recordingId);
            break;
          }
          case 'transcribe-recording': {
            console.log('Transcribing...');
            break;
          }
          case 'summarize-recording': {
            console.log('Summarizing...');
            break;
          }
        }
      } catch (error: unknown) {
        if (error instanceof RecordingRejectedError) {
          await recordings.markFailed(job.data.recordingId, JSON.stringify(error));
          throw new UnrecoverableError(error.reason);
        }
        if (error instanceof RecordingStateTransitionError) {
          throw new UnrecoverableError(error.message);
        }

        if (isFinalAttempt) {
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

export type RecordingProcessingQueue = ReturnType<typeof createRecordingProcessingQueue>;
