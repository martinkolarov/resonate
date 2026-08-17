import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ObjectStorage } from './object-storage.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export function createS3ObjectStorage({
  bucket,
  endpoint,
  region,
}: {
  bucket: string;
  endpoint?: string;
  region: string;
}): ObjectStorage {
  const client = new S3Client({
    endpoint,
    forcePathStyle: endpoint !== undefined,
    region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  return {
    provider: 's3',

    async getMetadata(key) {
      const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

      return {
        contentType: object.ContentType,
        etag: object.ETag,
        size: object.ContentLength ?? 0,
      };
    },

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
