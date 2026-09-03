import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorage } from './object-storage.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';

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

  async function getUploadUrl({
    key,
    contentType,
    expiresInSeconds,
    options,
  }: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
    options?: Record<string, string | number>;
  }) {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Key: key,
        Bucket: bucket,
        ContentType: contentType,
      }),
      {
        expiresIn: expiresInSeconds,
        ...options,
      }
    );
    return url;
  }

  async function getDownloadUrl(key: string) {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Key: key,
        Bucket: bucket,
      })
    );
    return url;
  }

  return {
    provider: 's3',

    async getMetadata(key) {
      const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

      return {
        contentType: response.ContentType,
        etag: response.ETag,
        size: response.ContentLength ?? 0,
      };
    },

    async createUploadTarget(key, contentType) {
      const expiresInSeconds = 10 * 60; // 10 minutes
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const url = await getUploadUrl({ key, contentType, expiresInSeconds });
      return {
        url,
        method: 'PUT',
        expiresAt,
      };
    },

    async uploadFromFile(key, sourcePath) {
      await client.send(
        new PutObjectCommand({
          Key: key,
          Bucket: bucket,
          Body: createReadStream(sourcePath),
        })
      );
    },

    async downloadToFile(key, destinationPath) {
      const response = await client.send(
        new GetObjectCommand({
          Key: key,
          Bucket: bucket,
        })
      );

      if (!(response.Body instanceof Readable)) {
        throw new Error('Body must be a valid stream');
      }

      await pipeline(response.Body, createWriteStream(destinationPath, { flags: 'wx' }));
    },

    getDownloadUrl,
  };
}
