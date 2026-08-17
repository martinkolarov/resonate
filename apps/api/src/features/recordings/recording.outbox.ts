import z from 'zod';
import type { RecordingQueue } from './recording.queue.js';

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
  recordingQueue: RecordingQueue
) {
  await recordingQueue.enqueueProcessRecording(message.payload, message.id);
}
