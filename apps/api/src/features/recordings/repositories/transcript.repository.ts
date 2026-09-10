import { Db } from 'mongodb';
import { TranscriptDocument, TranscriptSegment } from '../types.js';

export function createTranscriptRepository(mongo: Db) {
  const transcripts = mongo.collection<TranscriptDocument>('transcripts');
  return {
    async create({
      recordingId,
      provider,
      model,
      audioDurationSeconds,
      languageCode,
      text,
      segments,
    }: {
      recordingId: string;
      provider: string;
      model: string;
      audioDurationSeconds: number;
      languageCode: string;
      text: string;
      segments: TranscriptSegment[];
    }) {
      await transcripts.insertOne({
        recordingId,
        provider,
        model,
        audioDurationSeconds,
        languageCode,
        text,
        segments,
        createdAt: new Date(),
      });
    },

    async upsert(
      recordingId: string,
      {
        provider,
        model,
        audioDurationSeconds,
        languageCode,
        text,
        segments,
      }: {
        provider: string;
        model: string;
        audioDurationSeconds: number;
        languageCode: string;
        text: string;
        segments: TranscriptSegment[];
      }
    ) {
      const now = new Date();
      await transcripts.updateOne(
        { recordingId },
        {
          $set: {
            recordingId,
            provider,
            model,
            audioDurationSeconds,
            languageCode,
            text,
            segments,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    },
  };
}

export type TranscriptRepository = ReturnType<typeof createTranscriptRepository>;
