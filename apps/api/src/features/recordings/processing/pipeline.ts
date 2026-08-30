import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { createRecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError, RecordingStateTransitionError } from './errors.js';
import { createTranscodeRecording } from './transcode-recording.js';
import { createValidateRecording } from './validate-recording.js';

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
  'mediaProcessor' | 'objectStorage' | 'postgres' | 'redis'
>;

export function createRecordingPipeline(infrastructure: RecordingPipelineDeps) {
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
  const validateRecording = createValidateRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    recordings,
  });
  const transcodeRecording = createTranscodeRecording({
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
          case 'validate-recording': {
            const recordingId = job.data.recordingId;
            await validateRecording(recordingId);
            await enqueueTranscodeRecording({ recordingId });
            break;
          }
          case 'transcode-recording': {
            await transcodeRecording(job.data.recordingId);
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
