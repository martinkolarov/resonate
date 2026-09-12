import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { createRecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError } from './errors.js';
import { createTranscodeRecording } from './transcode-recording.js';
import { createValidateRecording } from './validate-recording.js';
import { createTranscribeRecording } from './transcribe-recording.js';
import { createTranscriptRepository } from '../repositories/transcript.repository.js';
import type { RecordingOutboxPublisher } from '../outbox.js';

type ValidateRecordingJobData = {
  recordingId: string;
};
type TranscodeRecordingJobData = {
  recordingId: string;
};
type TranscribeRecordingJobData = {
  recordingId: string;
};
type SummarizeRecordingJobData = {
  recordingId: string;
};

type RecordingJobData =
  | ValidateRecordingJobData
  | TranscodeRecordingJobData
  | TranscribeRecordingJobData
  | SummarizeRecordingJobData;

type RecordingJobName =
  'validate-recording' | 'transcode-recording' | 'transcribe-recording' | 'summarize-recording';

type RecordingPipelineDeps = Pick<
  Infrastructure,
  | 'mediaProcessor'
  | 'objectStorage'
  | 'postgres'
  | 'redis'
  | 'mongo'
  | 'transactionRunner'
>;

export function createRecordingPipeline(
  infrastructure: RecordingPipelineDeps,
  recordingOutbox: RecordingOutboxPublisher
) {
  const queue = new Queue<RecordingJobData, unknown, RecordingJobName>('recordings', {
    connection: infrastructure.redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
    },
  });
  async function enqueueValidateRecording(data: ValidateRecordingJobData) {
    await queue.add('validate-recording', data, {
      jobId: `validate-recording-${data.recordingId}`,
    });
  }
  async function enqueueTranscodeRecording(data: TranscodeRecordingJobData) {
    await queue.add('transcode-recording', data, {
      jobId: `transcode-recording-${data.recordingId}`,
    });
  }
  async function enqueueTranscribeRecording(data: TranscribeRecordingJobData) {
    await queue.add('transcribe-recording', data, {
      jobId: `transcribe-recording-${data.recordingId}`,
    });
  }
  async function enqueueSummarizeRecording(data: SummarizeRecordingJobData) {
    await queue.add('summarize-recording', data, {
      jobId: `summarize-recording-${data.recordingId}`,
    });
  }

  const recordings = createRecordingRepository(infrastructure.postgres);
  const transcripts = createTranscriptRepository(infrastructure.mongo);

  const validateRecording = createValidateRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordings,
  });
  const transcodeRecording = createTranscodeRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordings,
  });
  const transcribeRecording = createTranscribeRecording({
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordings,
    transcripts,
  });
  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      try {
        switch (job.name) {
          case 'validate-recording': {
            const recordingId = job.data.recordingId;
            await validateRecording(recordingId);
            break;
          }
          case 'transcode-recording': {
            const recordingId = job.data.recordingId;
            await transcodeRecording(recordingId);
            break;
          }
          case 'transcribe-recording': {
            const recordingId = job.data.recordingId;
            await transcribeRecording(recordingId);
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
        if (isFinalAttempt) {
          await recordings.markFailed(job.data.recordingId, JSON.stringify(error));
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
    enqueueValidateRecording,
    enqueueTranscodeRecording,
    enqueueTranscribeRecording,
    enqueueSummarizeRecording,
    async close() {
      await worker.close();
      await queue.close();
    },
    async run() {
      await worker.run();
    },
  };
}

export type RecordingPipeline = ReturnType<typeof createRecordingPipeline>;
