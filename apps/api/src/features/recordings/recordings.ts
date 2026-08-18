import type { RecordingRepository } from './repositories/recording.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';

type RecordingsDeps = {
  objectStorage: ObjectStorage;
  outboxMessages: OutboxMessageRepository;
  recordings: RecordingRepository;
  transactionRunner: TransactionRunner;
};

export function createRecordings({
  objectStorage,
  outboxMessages,
  recordings,
  transactionRunner,
}: RecordingsDeps) {
  return {
    async listByUserId(userId: string) {
      return await recordings.listByUserId(userId);
    },

    async getById(id: string) {
      return recordings.getById(id);
    },

    async startUpload(userId: string, fileName: string, mimeType: string) {
      const objectKey = `uploads/${userId}/${crypto.randomUUID()}`;
      const recording = await recordings.create({
        userId,
        objectKey,
        fileName,
        mimeType,
        provider: objectStorage.provider,
      });
      if (!recording) {
        throw new Error('Recording could not be created');
      }
      const uploadTarget = await objectStorage.createUploadTarget(objectKey, mimeType);
      return {
        recordingId: recording.id,
        uploadTarget,
      };
    },

    async completeUpload(userId: string, recordingId: string) {
      return transactionRunner.run(async trx => {
        const recording = await recordings.markUploaded(userId, recordingId, trx);
        if (recording) {
          await outboxMessages.enqueue(
            'recording-uploaded',
            {
              recordingId,
            },
            trx
          );
        }
      });
    },
  };
}

export type Recordings = ReturnType<typeof createRecordings>;
