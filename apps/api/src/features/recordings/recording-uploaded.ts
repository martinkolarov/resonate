import z from 'zod';
import type { RecordingPipeline } from './processing/pipeline.js';

export const recordingUploadedSchema = z.object({
  id: z.string(),
  type: z.literal('recording.uploaded'),
  payload: z.object({
    recordingId: z.string(),
  }),
});

type RecordingUploaded = z.infer<typeof recordingUploadedSchema>;

export async function handleRecordingUploaded(
  message: RecordingUploaded,
  recordingPipeline: RecordingPipeline
) {
  await recordingPipeline.enqueueValidateRecording({ recordingId: message.payload.recordingId });
}
