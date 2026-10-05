import type { RecordingRepository } from './repositories/recording.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import type { RecordingOutboxPublisher } from './outbox.js';
import type { RecordingEventRepository } from './repositories/recording-event.repository.js';
import { setTimeout } from 'node:timers/promises';

type RecordingServiceDeps = {
  objectStorage: ObjectStorage;
  recordingOutbox: RecordingOutboxPublisher;
  recordingEvents: RecordingEventRepository;
  recordings: RecordingRepository;
  transactionRunner: TransactionRunner;
};

export function createRecordingService({
  objectStorage,
  recordingOutbox,
  recordingEvents,
  recordings,
  transactionRunner,
}: RecordingServiceDeps) {
  return {
    async listByUserId(userId: string) {
      return await recordings.listByUserId(userId);
    },

    async getById(id: string) {
      return recordings.getById(id);
    },

    async startUpload(userId: string, fileName: string, contentType: string) {
      const inputObjectKey = `uploads/${userId}/${crypto.randomUUID()}`;
      const recording = await recordings.create({
        userId,
        inputObjectKey,
        fileName,
        storageProvider: objectStorage.provider,
      });
      if (!recording) {
        throw new Error('Recording could not be created');
      }
      const uploadTarget = await objectStorage.createUploadTarget(inputObjectKey, contentType);
      return {
        recordingId: recording.id,
        uploadTarget,
      };
    },

    async completeUpload(userId: string, recordingId: string) {
      return transactionRunner.run(async trx => {
        const uploadedRecording = await recordings.markUploaded(userId, recordingId, trx);
        if (!uploadedRecording) {
          throw new Error(`Could not mark recording ${recordingId} as uploaded`);
        }
        const validatingRecording = await recordings.startValidation(recordingId, trx);
        if (!validatingRecording) {
          throw new Error(`Could not mark recording ${recordingId} as validating`);
        }
        await recordingEvents.create(
          {
            recordingId,
            processingJobId: `validate-recording-${recordingId}`,
            status: validatingRecording.status,
            processingStage: validatingRecording.processing_stage,
          },
          trx
        );
        await recordingOutbox.publishStageChanged(
          {
            stage: 'validating',
            recordingId,
          },
          trx
        );
      });
    },

    async userOwnsRecording(userId: string, recordingId: string) {
      const recording = await recordings.getById(recordingId);
      if (recording && userId === recording.user_id) {
        return true;
      }
      return false;
    },

    async getRecordingEvents(recordingId: string, lastEventId?: string) {
      return lastEventId
        ? recordingEvents.listByRecordingIdAfterCursor(recordingId, lastEventId)
        : recordingEvents.listByRecordingId(recordingId);
    },

    async *watchForRecordingEvents({
      recordingId,
      lastEventId,
      signal,
    }: {
      recordingId: string;
      signal: AbortSignal;
      lastEventId?: string;
    }) {
      let cursor = lastEventId;
      while (!signal.aborted) {
        const events = await this.getRecordingEvents(recordingId, cursor);
        for (const event of events) {
          yield event;
          cursor = event.id;
          if (event.status === 'ready' || event.status === 'failed') return;
        }
        await setTimeout(1000, undefined, { signal }).catch(() => {});
      }
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
