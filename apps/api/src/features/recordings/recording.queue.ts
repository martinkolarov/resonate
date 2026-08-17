import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { createRecordingRepository } from './repositories/recording.repository.js';

const MAX_FILE_SIZE_MB = 150;

export const SUPPORTED_RECORDING_MIME_TYPES = [
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

const supportedRecordingMimeTypes: ReadonlySet<string> = new Set(SUPPORTED_RECORDING_MIME_TYPES);

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

type RecordingQueueWorkerDeps = Pick<Infrastructure, 'db' | 'objectStorage' | 'redis'>;

export function createRecordingQueueWorker(infrastructure: RecordingQueueWorkerDeps) {
  const recordings = createRecordingRepository(infrastructure.db);

  function getBaseMimeType(mimeType: string | undefined) {
    if (typeof mimeType === 'string') {
      return mimeType.split(';', 1)[0].trim().toLowerCase();
    }
    return mimeType;
  }

  async function processRecording(data: RecordingJobData) {
    const recording = await recordings.getById(data.recordingId);
    if (!recording) {
      throw new UnrecoverableError('RECORDING_NOT_FOUND');
    }
    await recordings.updateProcessingStage(recording.id, 'validating');
    const objectMetadata = await infrastructure.objectStorage.getMetadata(recording.object_key);
    const contentType = getBaseMimeType(objectMetadata.contentType);
    const size = objectMetadata.size;
    if (!contentType || !supportedRecordingMimeTypes.has(contentType)) {
      throw new UnrecoverableError('UNSUPPORTED_CONTENT_TYPE');
    }
    if (size === 0) {
      throw new UnrecoverableError('EMPTY_FILE');
    }
    if (size / 1000000 > MAX_FILE_SIZE_MB) {
      throw new UnrecoverableError('MAX_FILE_SIZE_EXCEEDED');
    }
    await recordings.completeValidation(recording.id, size, contentType);
  }

  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      try {
        switch (job.name) {
          case 'process-recording':
            await processRecording(job.data);
            break;
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
