import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorage } from './object-storage.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function createS3ObjectStorage({
  bucket,
  region,
}: {
  bucket: string;
  region: string;
}): ObjectStorage {
  const client = new S3Client({
    region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  return {
    provider: 's3',

    async createUploadTarget(key, contentType) {
      const expirationSeconds = 10 * 60; // 10 minutes
      const expiresAt = new Date(Date.now() + expirationSeconds * 1000);
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Key: key,
          Bucket: bucket,
          ContentType: contentType,
        }),
        { expiresIn: expirationSeconds }
      );
      return {
        url,
        method: 'PUT',
        expiresAt,
      };
    },
  };
}
