import z from 'zod';

export const transcriptSummarySchema = z.object({
  speakers: z.array(
    z.object({
      speakerId: z.string(),
      identifiedName: z.string().nullable(),
      evidenceSegmentIds: z.array(z.number()),
    })
  ),
  summary: z.string(),
  keyPoints: z.array(
    z.object({
      text: z.string(),
      speakerIds: z.array(z.string()),
      evidenceSegmentIds: z.array(z.number()),
    })
  ),
  actionItems: z.array(
    z.object({
      text: z.string(),
      ownerSpeakerId: z.string().nullable(),
      evidenceSegmentIds: z.array(z.number()),
    })
  ),
});

export type TranscriptSummary = z.infer<typeof transcriptSummarySchema>;

export type TranscriptSegmentWord = {
  type: 'word' | 'spacing' | 'audio_event';
  text: string;
  start: number | null | undefined;
  end: number | null | undefined;
};

export type TranscriptSegment = {
  speakerId: string | null | undefined;
  words: TranscriptSegmentWord[];
};

export type TranscriptDocument = {
  recordingId: string;
  provider: string;
  model: string;
  audioDurationSeconds: number;
  languageCode: string;
  text: string;
  summary?: TranscriptSummary;
  segments: TranscriptSegment[];
  createdAt: Date;
  updatedAt?: Date;
};
