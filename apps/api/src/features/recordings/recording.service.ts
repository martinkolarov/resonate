import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { RecordingRepository } from './repositories/recording.repository.js';
import env from '@/env.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { TransactionRunner } from '@/infrastructure/transaction-runner.js';
import type { OutboxMessageRepository } from '@/infrastructure/outbox/outbox-message.repository.js';

const client = new S3Client({
  region: env.AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

type RecordingServiceDependencies = {
  transactionRunner: TransactionRunner;
  outboxMessages: OutboxMessageRepository;
  recordings: RecordingRepository;
};

export function createRecordingService({
  transactionRunner,
  outboxMessages,
  recordings,
}: RecordingServiceDependencies) {
  return {
    async listRecordingsByUserId(userId: string) {
      return await recordings.listByUserId(userId);
    },

    async getRecordingById(id: string) {
      return recordings.getById(id);
    },

    async createRecording({
      userId,
      objectKey,
      fileName,
    }: {
      userId: string;
      objectKey: string;
      fileName: string;
    }) {
      const recording = await recordings.create({
        userId,
        objectKey,
        fileName,
        provider: 's3',
      });
      return recording;
    },

    async createUploadTarget(key: string, contentType: string) {
      const expirationSeconds = 10 * 60; // 10 minutes
      const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Key: key,
          Bucket: env.AWS_S3_BUCKET,
          ContentType: contentType,
        }),
        { expiresIn: expirationSeconds }
      );
      return {
        url,
        method: 'PUT' as const,
        expiresAt,
      };
    },

    async completeUpload(id: string) {
      return transactionRunner.run(async trx => {
        const recording = await recordings.markUploaded(id, trx);
        if (recording) {
          await outboxMessages.enqueue(
            'recording-uploaded',
            {
              id,
            },
            trx
          );
        }
      });
    },
  };
}

export type RecordingService = ReturnType<typeof createRecordingService>;
