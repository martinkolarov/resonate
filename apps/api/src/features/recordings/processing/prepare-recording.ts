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

function validateSourceMetadata(sizeBytes: number, mimeType: string | undefined) {
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
  return baseMimeType;
}

async function verifyTranscodedFile(transcodedFilePath: string) {
  const transcodedFileStats = await stat(transcodedFilePath);
  if (!transcodedFileStats.isFile() || transcodedFileStats.size === 0) {
    throw new Error('MP3 output is missing or empty');
  }
}

async function withRecordingWorkspace<T>(
  recordingId: string,
  run: (paths: { sourceFilePath: string; transcodedFilePath: string }) => Promise<T>
) {
  const directory = await mkdtemp(join(tmpdir(), `recording-${recordingId}-`));
  try {
    return await run({
      sourceFilePath: join(directory, 'source'),
      transcodedFilePath: join(directory, 'transcoded'),
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
  async function validateRecording(recordingId: string, sourceFilePath: string) {
    const recording = await recordings.startProcessing(recordingId);
    if (!recording) {
      throw new RecordingRejectedError('RECORDING_NOT_FOUND');
    }

    const objectMetadata = await objectStorage.getMetadata(recording.input_object_key);
    const mimeType = validateSourceMetadata(objectMetadata.size, objectMetadata.contentType);
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
      mimeType,
      durationMs: Math.round(media.durationSeconds * 1000),
    });

    if (!validatedRecording) {
      throw new RecordingStateTransitionError(recording.id, 'validating', 'transcoding');
    }

    return validatedRecording;
  }

  async function transcodeRecording(
    recordingId: string,
    sourceFilePath: string,
    transcodedFilePath: string
  ) {
    try {
      await mediaProcessor.transcodeToMp3(sourceFilePath, transcodedFilePath);
    } catch {
      throw new RecordingRejectedError('TRANSCODING_FAILED');
    }

    await verifyTranscodedFile(transcodedFilePath);
    const transcodedObjectKey = `recordings/${recordingId}`;
    await objectStorage.uploadFromFile(transcodedObjectKey, transcodedFilePath);

    const transcodedRecording = await recordings.completeTranscoding(
      recordingId,
      transcodedObjectKey
    );
    if (!transcodedRecording) {
      throw new RecordingStateTransitionError(recordingId, 'transcoding', 'transcribing');
    }

    return transcodedRecording;
  }

  return async function prepareRecording(recordingId: string): Promise<void> {
    return withRecordingWorkspace(recordingId, async paths => {
      const recording = await validateRecording(recordingId, paths.sourceFilePath);
      await transcodeRecording(recording.id, paths.sourceFilePath, paths.transcodedFilePath);
    });
  };
}
