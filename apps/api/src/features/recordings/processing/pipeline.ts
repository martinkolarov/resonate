import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import { createRecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError } from './errors.js';
import { createTranscodeRecording } from './transcode-recording.js';
import { createValidateRecording } from './validate-recording.js';
import { createTranscribeRecording } from './transcribe-recording.js';
import { createTranscriptRepository } from '../repositories/transcript.repository.js';
import type { RecordingOutboxPublisher } from '../outbox.js';
import { createSummarizeRecording } from './summarize-recording.js';
import { createRecordingEventRepository } from '../repositories/recording-event.repository.js';

type RecordingJobName =
  'validate-recording' | 'transcode-recording' | 'transcribe-recording' | 'summarize-recording';

const recordingStageByJobName = {
  'validate-recording': 'validating',
  'transcode-recording': 'transcoding',
  'transcribe-recording': 'transcribing',
  'summarize-recording': 'summarizing',
} as const satisfies Record<RecordingJobName, string>;

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

type RecordingPipelineDeps = Pick<
  Infrastructure,
  'mediaProcessor' | 'objectStorage' | 'postgres' | 'redis' | 'mongo' | 'transactionRunner'
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
  const recordingEvents = createRecordingEventRepository();
  const transcripts = createTranscriptRepository(infrastructure.mongo);

  async function failRecording(
    recordingId: string,
    processingJobId: string,
    processingStage: string,
    storedReason: string,
    eventReason: string
  ) {
    await infrastructure.transactionRunner.run(async trx => {
      const failedRecording = await recordings.markFailed(
        recordingId,
        processingStage,
        storedReason,
        trx
      );
      if (!failedRecording) {
        return;
      }
      await recordingEvents.create(
        {
          recordingId,
          processingJobId,
          status: failedRecording.status,
          processingStage: failedRecording.processing_stage,
          failedReason: eventReason,
        },
        trx
      );
    });
  }

  const validateRecording = createValidateRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordingEvents,
    recordings,
  });
  const transcodeRecording = createTranscodeRecording({
    mediaProcessor: infrastructure.mediaProcessor,
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordingEvents,
    recordings,
  });
  const transcribeRecording = createTranscribeRecording({
    objectStorage: infrastructure.objectStorage,
    transactionRunner: infrastructure.transactionRunner,
    recordingOutbox,
    recordingEvents,
    recordings,
    transcripts,
  });
  const summarizeRecording = createSummarizeRecording({
    recordings,
    recordingEvents,
    transcripts,
    transactionRunner: infrastructure.transactionRunner,
  });
  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attempts;
      const processingJobId = job.id ?? `${job.name}-${job.data.recordingId}`;
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
            const recordingId = job.data.recordingId;
            await summarizeRecording(recordingId);
            break;
          }
        }
      } catch (error: unknown) {
        if (error instanceof RecordingRejectedError) {
          await failRecording(
            job.data.recordingId,
            processingJobId,
            recordingStageByJobName[job.name],
            JSON.stringify(error),
            error.reason
          );
          throw new UnrecoverableError(error.reason);
        }
        if (isFinalAttempt) {
          await failRecording(
            job.data.recordingId,
            processingJobId,
            recordingStageByJobName[job.name],
            JSON.stringify(error),
            'PROCESSING_FAILED'
          );
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
