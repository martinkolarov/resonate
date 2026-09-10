import z from 'zod';
import type { RecordingPipeline } from './processing/pipeline.js';

export const recordingUploadedPayloadSchema = z.object({
  recordingId: z.string(),
});

export function createrRecordingOutboxHandler(recordingPipeline: RecordingPipeline) {
  return {
    'recording.uploaded': async (message: { payload: unknown }) => {
      const { recordingId } = recordingUploadedPayloadSchema.parse(message.payload);
      await recordingPipeline.enqueueValidateRecording({
        recordingId,
      });
    },
  };
}
