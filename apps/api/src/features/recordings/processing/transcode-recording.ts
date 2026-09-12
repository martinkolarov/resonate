import { MediaProcessor } from '@/infrastructure/media/media-processor.js';
import { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { stat } from 'node:fs/promises';
import { RecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError } from './errors.js';
import { withRecordingWorkspace } from './with-recording-workspace.js';
import { join } from 'node:path';
import { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { RecordingOutboxPublisher } from '../outbox.js';

async function fileExists(filePath: string) {
  const fileStats = await stat(filePath);
  return fileStats.isFile() && fileStats.size > 0;
}

type TranscodeRecordingDeps = {
  mediaProcessor: MediaProcessor;
  objectStorage: ObjectStorage;
  transactionRunner: TransactionRunner;
  recordingOutbox: RecordingOutboxPublisher;
  recordings: RecordingRepository;
};

export function createTranscodeRecording({
  mediaProcessor,
  objectStorage,
  transactionRunner,
  recordingOutbox,
  recordings,
}: TranscodeRecordingDeps) {
  return async function transcodeRecording(recordingId: string) {
    const recording = await recordings.getById(recordingId);
    if (!recording) {
      throw new RecordingRejectedError('RECORDING_NOT_FOUND');
    }

    if (recording.status !== 'processing' || recording.processing_stage !== 'transcoding') {
      return;
    }

    return withRecordingWorkspace(recordingId, async workspaceDirectory => {
      const sourceFilePath = join(workspaceDirectory, 'source');
      const transcodedFilePath = join(workspaceDirectory, 'transcoded');

      await objectStorage.downloadToFile(recording.input_object_key, sourceFilePath);

      try {
        await mediaProcessor.transcodeToMp3(sourceFilePath, transcodedFilePath);
      } catch {
        throw new RecordingRejectedError('TRANSCODING_FAILED');
      }

      const transcodedFileExists = await fileExists(transcodedFilePath);
      if (!transcodedFileExists) {
        throw new Error('Transcoded file is missing or empty');
      }

      const transcodedObjectKey = `recordings/${recordingId}`;
      await objectStorage.uploadFromFile(transcodedObjectKey, transcodedFilePath, 'audio/mpeg');

      await transactionRunner.run(async trx => {
        const transcodedRecording = await recordings.completeTranscoding(
          recordingId,
          transcodedObjectKey,
          'audio/mpeg',
          trx
        );

        if (!transcodedRecording) {
          return;
        }
        await recordingOutbox.publishStageChanged(
          {
            stage: 'transcribing',
            recordingId,
          },
          trx
        );
      });
    });
  };
}
