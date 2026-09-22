import { transcribe } from 'ai';
import { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { RecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError } from './errors.js';
import env from '@/env.js';
import { createElevenLabs } from '@ai-sdk/elevenlabs';
import z from 'zod';
import { TranscriptRepository } from '../repositories/transcript.repository.js';
import { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { RecordingOutboxPublisher } from '../outbox.js';
import { withRecordingWorkspace } from './with-recording-workspace.js';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { RecordingEventRepository } from '../repositories/recording-event.repository.js';

const elevenLabsBodySchema = z.object({
  language_code: z.string(),
  text: z.string(),
  audio_duration_secs: z.number(),
  words: z.array(
    z.object({
      text: z.string(),
      start: z.number().nullish(),
      end: z.number().nullish(),
      type: z.enum(['word', 'spacing', 'audio_event']),
      speaker_id: z.string().nullish(),
      logprob: z.number().optional(),
    })
  ),
});

const elevenLabsResponseSchema = z.object({
  body: elevenLabsBodySchema,
});

const elevenLabs = createElevenLabs({
  apiKey: env.ELEVENLABS_API_KEY,
});

/* eslint-disable @typescript-eslint/no-explicit-any */
function wordsToSegments(words: any) {
  let currentSpeakerId;
  const segments = [];
  for (const word of words) {
    if (word.speaker_id !== currentSpeakerId) {
      currentSpeakerId = word.speaker_id;
      segments.push({
        speakerId: currentSpeakerId,
        words: [
          {
            type: word.type,
            text: word.text,
            start: word.start,
            end: word.end,
          },
        ],
      });
    } else {
      segments.at(-1)?.words.push({
        type: word.type,
        text: word.text,
        start: word.start,
        end: word.end,
      });
    }
  }
  return segments;
}

type TranscribeRecordingDeps = {
  objectStorage: ObjectStorage;
  transactionRunner: TransactionRunner;
  recordingOutbox: RecordingOutboxPublisher;
  recordingEvents: RecordingEventRepository;
  recordings: RecordingRepository;
  transcripts: TranscriptRepository;
};

export function createTranscribeRecording({
  objectStorage,
  transactionRunner,
  recordingOutbox,
  recordingEvents,
  recordings,
  transcripts,
}: TranscribeRecordingDeps) {
  return async function transcribeRecording(recordingId: string) {
    const recording = await recordings.getById(recordingId);
    if (!recording) {
      throw new RecordingRejectedError('RECORDING_NOT_FOUND');
    }
    if (recording.status !== 'processing' || recording.processing_stage !== 'transcribing') {
      return;
    }
    const outputObjectKey = recording.output_object_key;
    if (!outputObjectKey) {
      throw new RecordingRejectedError('EMPTY_FILE');
    }
    return withRecordingWorkspace(recordingId, async workspaceDirectory => {
      const audioFilePath = join(workspaceDirectory, 'source');
      await objectStorage.downloadToFile(outputObjectKey, audioFilePath);
      const result = await transcribe({
        model: elevenLabs.transcription('scribe_v2'),
        audio: await readFile(audioFilePath),
        providerOptions: {
          elevenlabs: {
            diarize: true,
            timestampsGranularity: 'word',
            tagAudioEvents: true,
          },
        },
      });
      const response = z.array(elevenLabsResponseSchema).parse(result.responses)[0];
      const { language_code, text, audio_duration_secs, words } = response.body;
      const segments = wordsToSegments(words);
      await transcripts.upsert(recordingId, {
        model: 'scribe_v2',
        provider: 'elevenlabs',
        languageCode: language_code,
        audioDurationSeconds: audio_duration_secs,
        text,
        segments,
      });
      await transactionRunner.run(async trx => {
        const transcribedRecording = await recordings.completeTranscription(recordingId, trx);
        if (!transcribedRecording) {
          return;
        }
        await recordingEvents.create(
          {
            recordingId,
            processingJobId: `summarize-recording-${recordingId}`,
            status: transcribedRecording.status,
            processingStage: transcribedRecording.processing_stage,
          },
          trx
        );
        await recordingOutbox.publishStageChanged(
          {
            stage: 'summarizing',
            recordingId,
          },
          trx
        );
      });
    });
  };
}
