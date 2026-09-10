import { MediaInfo, MediaProcessor } from '@/infrastructure/media/media-processor.js';
import { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { RecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError, RecordingStateTransitionError } from './errors.js';
import { withRecordingWorkspace } from './with-recording-workspace.js';
import { join } from 'node:path';

const MAX_FILE_SIZE_BYTES = 100_000_000; // 100 MB
const MAX_RECORDING_DURATION_SECONDS = 60 * 60; // 60 minutes

const SUPPORTED_RECORDING_MIME_TYPES = [
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

function getMimeType(mimeType: string | undefined) {
  if (typeof mimeType === 'string') {
    return mimeType.split(';', 1)[0].trim().toLowerCase();
  }
  return mimeType;
}

type ValidateRecordingDeps = {
  mediaProcessor: MediaProcessor;
  objectStorage: ObjectStorage;
  recordings: RecordingRepository;
};

export function createValidateRecording({
  mediaProcessor,
  objectStorage,
  recordings,
}: ValidateRecordingDeps) {
  return async function validateRecording(recordingId: string) {
    const recording = await recordings.getById(recordingId);
    if (!recording) {
      throw new RecordingRejectedError('RECORDING_NOT_FOUND');
    }

    if (recording.status !== 'processing' || recording.processing_stage !== 'validating') {
      return;
    }

    return withRecordingWorkspace(recordingId, async workspaceDirectory => {
      const sourceFilePath = join(workspaceDirectory, 'source');

      const objectMetadata = await objectStorage.getMetadata(recording.input_object_key);
      const mimeType = getMimeType(objectMetadata.contentType);

      if (!mimeType || !supportedRecordingMimeTypes.has(mimeType)) {
        throw new RecordingRejectedError('UNSUPPORTED_CONTENT_TYPE');
      }
      if (objectMetadata.size === 0) {
        throw new RecordingRejectedError('EMPTY_FILE');
      }
      if (objectMetadata.size > MAX_FILE_SIZE_BYTES) {
        throw new RecordingRejectedError('MAX_FILE_SIZE_EXCEEDED');
      }

      await objectStorage.downloadToFile(recording.input_object_key, sourceFilePath);

      let media: MediaInfo;
      try {
        media = await mediaProcessor.inspect(sourceFilePath);
      } catch {
        throw new RecordingRejectedError('INSPECTION_FAILED');
      }

      if (media.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
        throw new RecordingRejectedError('MAX_DURATION_EXCEEDED');
      }

      const validatedRecording = await recordings.completeValidation(recording.id, {
        sizeBytes: objectMetadata.size,
        inputMimeType: mimeType,
        durationMs: Math.round(media.durationSeconds * 1000),
      });

      if (!validatedRecording) {
        throw new RecordingStateTransitionError(recording.id, 'validating', 'transcoding');
      }
    });
  };
}
