import type { RecordingRepository } from './repositories/recording.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';

type RecordingServiceDeps = {
  objectStorage: ObjectStorage;
  outboxMessages: OutboxMessageRepository;
  recordings: RecordingRepository;
  transactionRunner: TransactionRunner;
};

export function createRecordingService({
  objectStorage,
  outboxMessages,
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
        await outboxMessages.enqueue(
          'recording.uploaded',
          {
            recordingId,
          },
          trx
        );
      });
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
