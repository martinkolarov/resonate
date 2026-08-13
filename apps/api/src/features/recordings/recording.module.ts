import { createRecordingBodySchema } from '@resonate/contracts';
import { createRecordingService } from '@/features/recordings/recording.service.js';
import { createRecordingRepository } from '@/features/recordings/repositories/recording.repository.js';
import type { Infrastructure } from '@/infrastructure/create-infrastructure.js';
import { ValidationError } from '@/lib/errors.js';
import { Router, type RequestHandler } from 'express';

type RecordingModuleDependencies = Pick<
  Infrastructure,
  'db' | 'transactionRunner' | 'outboxMessages'
> & {
  requireSession: RequestHandler;
};

type RecordingModule = {
  router: Router;
};

export function createRecordingModule({
  db,
  transactionRunner,
  outboxMessages,
  requireSession,
}: RecordingModuleDependencies): RecordingModule {
  const recordings = createRecordingRepository(db);
  const service = createRecordingService({ transactionRunner, outboxMessages, recordings });
  const router = Router();

  router.use(requireSession);

  router.get('/', async (_req, res) => {
    const recordings = await service.listRecordingsByUserId(res.locals.user.id);
    return res.json(
      recordings.map(recording => ({
        id: recording.id,
        fileName: recording.file_name,
        status: recording.status,
        createdAt: recording.created_at,
      }))
    );
  });

  router.post('/', async (req, res) => {
    const { success, error, data } = createRecordingBodySchema.safeParse(req.body);
    if (!success) {
      throw new ValidationError(error);
    }

    const { fileName, mimeType } = data;
    const userId = res.locals.user.id;
    const objectKey = `uploads/${userId}/${crypto.randomUUID()}`;
    const recording = await service.createRecording({
      userId,
      objectKey,
      fileName,
    });
    if (!recording) {
      throw new Error('Recording could not be created');
    }

    const uploadTarget = await service.createUploadTarget(objectKey, mimeType);
    return res.json({
      recording,
      uploadTarget,
    });
  });

  router.post('/:id/complete-upload', async (req, res) => {
    const { id } = req.params;
    await service.completeUpload(id);
    return res.json('OK');
  });

  return {
    router,
  };
}
