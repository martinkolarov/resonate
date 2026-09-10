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
  segments: TranscriptSegment[];
  createdAt: Date;
  updatedAt?: Date;
};
