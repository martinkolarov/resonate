import z from 'zod';
import type { RecordingProcessingQueue } from './processing/queue.js';

export const recordingUploadedSchema = z.object({
  id: z.string(),
  type: z.literal('recording-uploaded'),
  payload: z.object({
    recordingId: z.string(),
  }),
});

type RecordingUploaded = z.infer<typeof recordingUploadedSchema>;

export async function handleRecordingUploaded(
  message: RecordingUploaded,
  recordingQueue: RecordingProcessingQueue
) {
  await recordingQueue.enqueueProcessRecording(message.payload, message.id);
}
