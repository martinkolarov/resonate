import type { RecordingRepository } from '@/features/recordings/repositories/recording.repository.js';
import type { MediaInfo, MediaProcessor } from '@/infrastructure/media/media-processor.js';
import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordingRejectedError, RecordingStateTransitionError } from './processing-errors.js';

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

function getBaseMimeType(mimeType: string | undefined) {
  if (typeof mimeType === 'string') {
    return mimeType.split(';', 1)[0].trim().toLowerCase();
  }
  return mimeType;
}

function validateSource(sizeBytes: number, mimeType: string | undefined) {
  const baseMimeType = getBaseMimeType(mimeType);
  if (!baseMimeType || !supportedRecordingMimeTypes.has(baseMimeType)) {
    throw new RecordingRejectedError('UNSUPPORTED_CONTENT_TYPE');
  }
  if (sizeBytes === 0) {
    throw new RecordingRejectedError('EMPTY_FILE');
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new RecordingRejectedError('MAX_FILE_SIZE_EXCEEDED');
  }
  return {
    mimeType: baseMimeType,
    sizeBytes,
  };
}

function validateDuration(media: MediaInfo) {
  if (media.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    throw new RecordingRejectedError('MAX_DURATION_EXCEEDED');
  }
}

async function verifyOutput(outputPath: string) {
  const outputStats = await stat(outputPath);
  if (!outputStats.isFile() || outputStats.size === 0) {
    throw new Error('MP3 output is missing or empty');
  }
}

async function withTemporaryWorkspace<T>(
  recordingId: string,
  run: (paths: { input: string; output: string }) => Promise<T>
) {
  const directory = await mkdtemp(join(tmpdir(), `recording-${recordingId}-`));
  try {
    return await run({
      input: join(directory, 'input'),
      output: join(directory, 'output'),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

type PrepareRecordingDeps = {
  mediaProcessor: MediaProcessor;
  objectStorage: ObjectStorage;
  recordings: RecordingRepository;
};

export function createPrepareRecording({
  mediaProcessor,
  objectStorage,
  recordings,
}: PrepareRecordingDeps) {
  return async function prepareRecording(recordingId: string): Promise<void> {
    const recording = await recordings.startProcessing(recordingId);
    if (!recording) {
      throw new RecordingRejectedError('RECORDING_NOT_FOUND');
    }
    const objectMetadata = await objectStorage.getMetadata(recording.input_object_key);
    const { sizeBytes, mimeType } = validateSource(objectMetadata.size, objectMetadata.contentType);

    return withTemporaryWorkspace(recording.id, async paths => {
      await objectStorage.downloadToFile(recording.input_object_key, paths.input);

      let media: MediaInfo;
      try {
        media = await mediaProcessor.inspect(paths.input);
      } catch {
        throw new RecordingRejectedError('INSPECTION_FAILED');
      }

      validateDuration(media);

      const validatedRecording = await recordings.completeValidation(recording.id, {
        sizeBytes,
        mimeType,
        durationMs: Math.round(media.durationSeconds * 1000),
      });
      if (!validatedRecording) {
        throw new RecordingStateTransitionError(recording.id, 'validating', 'transcoding');
      }

      try {
        await mediaProcessor.transcodeToMp3(paths.input, paths.output);
      } catch {
        throw new RecordingRejectedError('TRANSCODING_FAILED');
      }

      await verifyOutput(paths.output);
      const outputObjectKey = `recordings/${recording.id}`;
      await objectStorage.uploadFromFile(outputObjectKey, paths.output);

      const transcodedRecording = await recordings.completeTranscoding(
        recordingId,
        outputObjectKey
      );
      if (!transcodedRecording) {
        throw new RecordingStateTransitionError(recording.id, 'transcoding', 'transcribing');
      }
    });
  };
}
