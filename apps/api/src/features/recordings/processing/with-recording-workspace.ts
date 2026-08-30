import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function withRecordingWorkspace<T>(
  recordingId: string,
  run: (workspaceDirectory: string) => Promise<T>
) {
  const workspaceDirectory = await mkdtemp(join(tmpdir(), `recording-${recordingId}-`));
  try {
    return await run(workspaceDirectory);
  } finally {
    await rm(workspaceDirectory, { recursive: true, force: true });
  }
}
