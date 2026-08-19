import type { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import type { MediaInfo, MediaProcessor } from '@/infrastructure/media/media-processor.js';
import type { RecordingRepository } from '@/features/recordings/repositories/recording.repository.js';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_FILE_SIZE_BYTES = 100_000_000;
const MAX_RECORDING_DURATION_SECONDS = 60 * 60;

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

type ProcessingFailureReason =
  | 'RECORDING_NOT_FOUND'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'EMPTY_FILE'
  | 'MAX_FILE_SIZE_EXCEEDED'
  | 'MAX_DURATION_EXCEEDED'
  | 'INVALID_MEDIA';

type ProcessingFailure = {
  ok: false;
  reason: ProcessingFailureReason;
};

export type ProcessRecordingResult = { ok: true } | ProcessingFailure;

function getBaseMimeType(mimeType: string | undefined) {
  if (typeof mimeType === 'string') {
    return mimeType.split(';', 1)[0].trim().toLowerCase();
  }
  return mimeType;
}

function validateSource(mimeType: string, sizeBytes: number): ProcessingFailure | undefined {
  if (!supportedRecordingMimeTypes.has(mimeType)) {
    return { ok: false, reason: 'UNSUPPORTED_CONTENT_TYPE' };
  }
  if (sizeBytes === 0) {
    return { ok: false, reason: 'EMPTY_FILE' };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'MAX_FILE_SIZE_EXCEEDED' };
  }
}

function validateDuration(media: MediaInfo): ProcessingFailure | undefined {
  if (media.durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    return { ok: false, reason: 'MAX_DURATION_EXCEEDED' };
  }
}

async function verifyOutput(outputPath: string) {
  const outputStats = await stat(outputPath);
  if (!outputStats.isFile() || outputStats.size === 0) {
    throw new Error('MP3 output is missing or empty');
  }
}

async function withProcessingWorkspace<T>(
  recordingId: string,
  process: (paths: { input: string; output: string }) => Promise<T>
) {
  const directory = await mkdtemp(join(tmpdir(), `recording-${recordingId}-`));
  try {
    return await process({
      input: join(directory, 'input'),
      output: join(directory, 'output'),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

type RecordingProcessorDeps = {
  mediaProcessor: MediaProcessor;
  objectStorage: ObjectStorage;
  recordings: RecordingRepository;
};

export function createRecordingProcessor({
  mediaProcessor,
  objectStorage,
  recordings,
}: RecordingProcessorDeps) {
  return {
    async process(recordingId: string): Promise<ProcessRecordingResult> {
      const recording = await recordings.getById(recordingId);
      if (!recording) {
        return { ok: false, reason: 'RECORDING_NOT_FOUND' };
      }
      await recordings.updateProcessingStage(recording.id, 'validating');
      const objectMetadata = await objectStorage.getMetadata(recording.object_key);
      const mimeType = getBaseMimeType(objectMetadata.contentType);
      const sizeBytes = objectMetadata.size;
      if (!mimeType) {
        return { ok: false, reason: 'UNSUPPORTED_CONTENT_TYPE' };
      }
      const sourceFailure = validateSource(mimeType, sizeBytes);
      if (sourceFailure) {
        return sourceFailure;
      }

      return withProcessingWorkspace(recording.id, async paths => {
        await objectStorage.downloadToFile(recording.object_key, paths.input);

        let media: MediaInfo;
        try {
          media = await mediaProcessor.inspect(paths.input);
        } catch {
          return { ok: false, reason: 'INVALID_MEDIA' };
        }

        const durationFailure = validateDuration(media);
        if (durationFailure) {
          return durationFailure;
        }

        await recordings.completeValidation(recording.id, {
          sizeBytes,
          mimeType,
          durationMs: Math.round(media.durationSeconds * 1000),
        });

        await recordings.updateProcessingStage(recording.id, 'transcoding');
        await mediaProcessor.transcodeToMp3(paths.input, paths.output);
        await verifyOutput(paths.output);

        return { ok: true };
      });
    },
  };
}

export type RecordingProcessor = ReturnType<typeof createRecordingProcessor>;
