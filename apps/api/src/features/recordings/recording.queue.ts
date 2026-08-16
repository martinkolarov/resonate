import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';

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

export function createRecordingQueueWorker(redis: Redis) {
  const worker = new Worker<RecordingJobData, unknown, RecordingJobName>(
    'recordings',
    async job => {
      switch (job.name) {
        case 'process-recording':
          console.log(job.data);
          break;
      }
    },
    {
      autorun: false,
      connection: redis,
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
