import { request } from '@/lib/request';
import {
  listRecordingsResponseSchema,
  createRecordingResponseSchema,
  type CreateRecordingBody,
} from '@resonate/contracts';

export async function getRecordings({ signal }: { signal?: AbortSignal }) {
  const response = await request('/api/recordings', {
    method: 'GET',
    signal,
  });
  return listRecordingsResponseSchema.parse(response);
}

export async function createRecording(body: CreateRecordingBody) {
  const response = await request('/api/recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return createRecordingResponseSchema.parse(response);
}

export async function completeUpload(recordingId: string) {
  await request(`/api/recordings/${recordingId}/complete-upload`, {
    method: 'POST',
  });
}
