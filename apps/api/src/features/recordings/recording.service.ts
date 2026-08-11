import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { RecordingRepository } from './repositories/recording.repository.js';
import env from '@/env.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TransactionRunner } from '@/infrastructure/transaction-runner.js';

const client = new S3Client({
  region: env.AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export class RecordingService {
  constructor(
    private readonly transactionRunner: TransactionRunner,
    private readonly recordings: RecordingRepository
  ) {}

  async listRecordingsByUserId(userId: string) {
    return await this.recordings.listByUserId(userId);
  }

  async getRecordingById(id: string) {
    return this.recordings.getById(id);
  }

  async createRecording({
    userId,
    objectKey,
    fileName,
  }: {
    userId: string;
    objectKey: string;
    fileName: string;
  }) {
    const recording = await this.recordings.create({
      userId,
      objectKey,
      fileName,
      provider: 's3',
    });
    return recording;
  }

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
  }

  async completeUpload(id: string) {
    return this.transactionRunner.run(async trx => {});
  }
}
