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

type RecordingRejectedReason =
  | 'RECORDING_NOT_FOUND'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'EMPTY_FILE'
  | 'MAX_FILE_SIZE_EXCEEDED'
  | 'MAX_DURATION_EXCEEDED'
  | 'INSPECTION_FAILED'
  | 'TRANSCODING_FAILED';

export class RecordingRejectedError extends Error {
  constructor(public readonly reason: RecordingRejectedReason) {
    super(reason);
  }

  toJSON() {
    return {
      type: 'RECORDING_REJECTED',
      reason: this.reason,
    };
  }
}

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
    async prepareRecording(recordingId: string): Promise<void> {
      const recording = await recordings.getById(recordingId);
      if (!recording) {
        throw new RecordingRejectedError('RECORDING_NOT_FOUND');
      }
      await recordings.updateProcessingStage(recording.id, 'validating');
      const objectMetadata = await objectStorage.getMetadata(recording.object_key);

      const { sizeBytes, mimeType } = validateSource(
        objectMetadata.size,
        objectMetadata.contentType
      );

      return withProcessingWorkspace(recording.id, async paths => {
        await objectStorage.downloadToFile(recording.object_key, paths.input);

        let media: MediaInfo;
        try {
          media = await mediaProcessor.inspect(paths.input);
        } catch {
          throw new RecordingRejectedError('INSPECTION_FAILED');
        }

        validateDuration(media);

        await recordings.completeValidation(recording.id, {
          sizeBytes,
          mimeType,
          durationMs: Math.round(media.durationSeconds * 1000),
        });

        try {
          await mediaProcessor.transcodeToMp3(paths.input, paths.output);
        } catch {
          throw new RecordingRejectedError('TRANSCODING_FAILED');
        }

        await verifyOutput(paths.output);
      });
    },
  };
}

export type RecordingProcessor = ReturnType<typeof createRecordingProcessor>;
