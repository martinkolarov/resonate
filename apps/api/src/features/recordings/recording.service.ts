import type { RecordingRepository } from './repositories/recording.repository.js';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { probeMedia, ProbeMediaResult } from '@/features/recordings/probe-media.js';
import { transcodeToMp3 } from '@/features/recordings/transcode-to-mp3.js';

const MAX_FILE_SIZE_MB = 100;
const MAX_RECORDING_DURATION_SECONDS = 60 * 60; // 60 minutes

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
        | 'MAX_FILE_SIZE_EXCEEDED'
        | 'MAX_DURATION_EXCEEDED'
        | 'INVALID_MEDIA';
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
      const mimeType = getBaseMimeType(objectMetadata.contentType);
      const sizeBytes = objectMetadata.size;

      if (!mimeType || !supportedRecordingMimeTypes.has(mimeType)) {
        return { ok: false, reason: 'UNSUPPORTED_CONTENT_TYPE' };
      }
      if (sizeBytes === 0) {
        return { ok: false, reason: 'EMPTY_FILE' };
      }
      if (sizeBytes / 1000000 > MAX_FILE_SIZE_MB) {
        return { ok: false, reason: 'MAX_FILE_SIZE_EXCEEDED' };
      }

      const workingDirectory = await mkdtemp(join(tmpdir(), `recording-${recording.id}-`));
      const inputPath = join(workingDirectory, 'input');
      const outputPath = join(workingDirectory, 'output');

      let probeResult: ProbeMediaResult;
      try {
        await objectStorage.downloadToFile(recording.object_key, inputPath);
        try {
          probeResult = await probeMedia(inputPath);
        } catch {
          return {
            ok: false,
            reason: 'INVALID_MEDIA',
          };
        }
        if (probeResult.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
          return {
            ok: false,
            reason: 'MAX_DURATION_EXCEEDED',
          };
        }
        await recordings.completeValidation(recording.id, {
          sizeBytes,
          mimeType,
          durationMs: Math.round(probeResult.durationSeconds * 1000),
        });

        await recordings.updateProcessingStage(recording.id, 'transcoding');
        await transcodeToMp3(inputPath, outputPath);
        const outputStats = await stat(outputPath);
        if (!outputStats.isFile() || outputStats.size === 0) {
          throw new Error('MP3 output is missing or empty');
        }
      } finally {
        await rm(workingDirectory, { recursive: true, force: true });
      }

      return { ok: true };
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
