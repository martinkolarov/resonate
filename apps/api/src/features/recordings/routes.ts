import { createRecordingBodySchema } from '@resonate/contracts';
import { createRecordingService } from '@/features/recordings/recording-service.js';
import { createRecordingRepository } from '@/features/recordings/repositories/recording.repository.js';
import type { Infrastructure } from '@/infrastructure/infrastructure.js';
import { ApiError, ValidationError } from '@/lib/errors.js';
import { Router, type RequestHandler } from 'express';
import { createRecordingOutboxPublisher } from './outbox.js';
import { createRecordingEventRepository } from './repositories/recording-event.repository.js';

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
  const recordings = createRecordingRepository(postgres);
  const recordingOutbox = createRecordingOutboxPublisher(outboxMessages);
  const recordingEvents = createRecordingEventRepository(postgres);
  const recordingService = createRecordingService({
    objectStorage,
    recordingOutbox,
    recordingEvents,
    recordings,
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

    const { fileName, contentType } = data;
    const userId = res.locals.user.id;

    const { recordingId, uploadTarget } = await recordingService.startUpload(
      userId,
      fileName,
      contentType
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

  router.get('/:recordingId/events', async (req, res) => {
    const { recordingId } = req.params;
    const userId = res.locals.user.id;
    const recording = await recordingService.getById(recordingId);
    if (!recording || recording.user_id !== userId) {
      throw new ApiError('NOT_FOUND');
    }

    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    let lastEventId: string | undefined;
    if (typeof req.headers['last-event-id'] === 'string') {
      lastEventId = req.headers['last-event-id'];
    }

    if (recording.status === 'ready' || recording.status === 'failed') {
      res.status(204).end();
      return;
    }

    res.setHeaders(
      new Map([
        ['Content-Type', 'text/event-stream'],
        ['Cache-Control', 'no-cache'],
      ])
    );
    res.flushHeaders();

    try {
      for await (const event of recordingService.watchForRecordingEvents({
        recordingId,
        lastEventId,
        signal: abortController.signal,
      })) {
        res.write(
          `id:${event.id}\ndata:${JSON.stringify({ status: event.status, processingStage: event.processing_stage })}\n\n`
        );
        if (event.status === 'ready' || event.status === 'failed') return;
      }
    } finally {
      res.end();
    }
  });

  return {
    router,
  };
}
