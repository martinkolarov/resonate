import { createRecordingBodySchema } from '@resonate/contracts';
import { createRecordingService } from '@/features/recordings/recording-service.js';
import { createRecordingRepository } from '@/features/recordings/repositories/recording.repository.js';
import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { ValidationError } from '@/lib/errors.js';
import { Router, type RequestHandler } from 'express';

type RecordingRoutesDeps = {
  infrastructure: Pick<
    Infrastructure,
    'postgres' | 'objectStorage' | 'outboxMessages' | 'transactionRunner'
  >;
  requireSession: RequestHandler;
};

type RecordingRoutes = {
  router: Router;
};

export function createRecordingRoutes({
  infrastructure,
  requireSession,
}: RecordingRoutesDeps): RecordingRoutes {
  const { postgres, objectStorage, outboxMessages, transactionRunner } = infrastructure;
  const recordingRepository = createRecordingRepository(postgres);
  const recordingService = createRecordingService({
    objectStorage,
    outboxMessages,
    recordings: recordingRepository,
    transactionRunner,
  });
  const router = Router();

  router.use(requireSession);

  router.get('/', async (_req, res) => {
    const results = await recordingService.listByUserId(res.locals.user.id);
    return res.json(
      results.map(recording => ({
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

    const { recordingId, uploadTarget } = await recordingService.startUpload(
      userId,
      fileName,
      mimeType
    );

    return res.json({
      recordingId,
      uploadTarget,
    });
  });

  router.post('/:recordingId/complete-upload', async (req, res) => {
    const { recordingId } = req.params;
    const userId = res.locals.user.id;
    await recordingService.completeUpload(userId, recordingId);
    return res.json('OK');
  });

  return {
    router,
  };
}
