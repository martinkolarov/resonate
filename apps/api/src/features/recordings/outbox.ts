import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';
import type { DB } from '@/types/db.generated.types.js';
import type { Transaction } from 'kysely';
import z from 'zod';
import type { RecordingPipeline } from './processing/pipeline.js';

export const recordingStageChangedMessageSchema = z.object({
  id: z.string(),
  type: z.literal('recording.stage-changed'),
  payload: z.object({
    stage: z.enum(['validating', 'transcoding', 'transcribing', 'summarizing']),
    recordingId: z.string(),
  }),
});

export type RecordingStageChangedMessage = z.infer<typeof recordingStageChangedMessageSchema>;

export function createRecordingOutboxPublisher(outboxMessages: OutboxMessageRepository) {
  return {
    publishStageChanged(
      payload: RecordingStageChangedMessage['payload'],
      trx: Transaction<DB>
    ) {
      return outboxMessages.enqueue('recording.stage-changed', payload, trx);
    },
  };
}

export type RecordingOutboxPublisher = ReturnType<typeof createRecordingOutboxPublisher>;

export function createRecordingOutboxHandlers(recordingPipeline: RecordingPipeline) {
  return {
    'recording.stage-changed': async (message: unknown) => {
      const { payload } = recordingStageChangedMessageSchema.parse(message);
      switch (payload.stage) {
        case 'validating':
          await recordingPipeline.enqueueValidateRecording({ recordingId: payload.recordingId });
          break;
        case 'transcoding':
          await recordingPipeline.enqueueTranscodeRecording({ recordingId: payload.recordingId });
          break;
        case 'transcribing':
          await recordingPipeline.enqueueTranscribeRecording({ recordingId: payload.recordingId });
          break;
        case 'summarizing':
          await recordingPipeline.enqueueSummarizeRecording({ recordingId: payload.recordingId });
          break;
        default:
          throw new Error(`Unhandled recording stage: ${payload.stage satisfies never}`);
      }
    },
  };
}
