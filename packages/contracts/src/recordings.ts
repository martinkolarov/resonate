import z from 'zod';

export const recordingSummarySchema = z.object({
  id: z.string(),
  fileName: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
});

export type RecordingSummary = z.infer<typeof recordingSummarySchema>;

export const listRecordingsResponseSchema = z.array(recordingSummarySchema);

export type ListRecordingsResponse = z.infer<typeof listRecordingsResponseSchema>;

export const createRecordingBodySchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
});

export type CreateRecordingBody = z.infer<typeof createRecordingBodySchema>;

export const createRecordingResponseSchema = z.object({
  recordingId: z.string(),
  uploadTarget: z.object({
    url: z.url(),
    method: z.string(),
    expiresAt: z.iso.datetime(),
  }),
});

export type CreateRecordingResponse = z.infer<typeof createRecordingResponseSchema>;
