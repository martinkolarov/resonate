import type { RecordingRepository } from './repositories/recording.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';

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

type ProcessRecordingResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'RECORDING_NOT_FOUND'
        | 'UNSUPPORTED_CONTENT_TYPE'
        | 'EMPTY_FILE'
        | 'MAX_FILE_SIZE_EXCEEDED';
    };

function getBaseMimeType(mimeType: string | undefined) {
  if (typeof mimeType === 'string') {
    return mimeType.split(';', 1)[0].trim().toLowerCase();
  }
  return mimeType;
}

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
    async listRecordingsByUserId(userId: string) {
      return await recordings.listByUserId(userId);
    },

    async getRecordingById(id: string) {
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

    async processRecording(recordingId: string): Promise<ProcessRecordingResult> {
      const recording = await recordings.getById(recordingId);
      if (!recording) {
        return { ok: false, reason: 'RECORDING_NOT_FOUND' };
      }

      await recordings.updateProcessingStage(recording.id, 'validating');

      const objectMetadata = await objectStorage.getMetadata(recording.object_key);
      const contentType = getBaseMimeType(objectMetadata.contentType);
      const size = objectMetadata.size; // bytes

      if (!contentType || !supportedRecordingMimeTypes.has(contentType)) {
        return { ok: false, reason: 'UNSUPPORTED_CONTENT_TYPE' };
      }
      if (size === 0) {
        return { ok: false, reason: 'EMPTY_FILE' };
      }
      if (size / 1000000 > MAX_FILE_SIZE_MB) {
        return { ok: false, reason: 'MAX_FILE_SIZE_EXCEEDED' };
      }

      await recordings.completeValidation(recording.id, size, contentType);

      return { ok: true };
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
