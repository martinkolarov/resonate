import { transcribe } from 'ai';
import { ObjectStorage } from '@/infrastructure/object-storage/object-storage.js';
import { RecordingRepository } from '../repositories/recording.repository.js';
import { RecordingRejectedError } from './errors.js';
import env from '@/env.js';
import { createElevenLabs } from '@ai-sdk/elevenlabs';
import z from 'zod';
import { TranscriptRepository } from '../repositories/transcript.repository.js';

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

type TranscribeRecordingDeps = {
  objectStorage: ObjectStorage;
  recordings: RecordingRepository;
  transcripts: TranscriptRepository;
};

export function createTranscribeRecording({
  objectStorage,
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
    const audioFileUrl = await objectStorage.getDownloadUrl(outputObjectKey);
    const elevenLabs = createElevenLabs({
      apiKey: env.ELEVENLABS_API_KEY,
    });
    const result = await transcribe({
      model: elevenLabs.transcription('scribe_v2'),
      audio: new URL(audioFileUrl),
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
    await transcripts.create({
      recordingId: recording.id,
      model: 'scribe_v2',
      provider: 'elevenlabs',
      languageCode: language_code,
      audioDurationSeconds: audio_duration_secs,
      text,
      segments,
    });
    return;
  };
}
