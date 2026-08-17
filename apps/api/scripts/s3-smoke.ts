import env from '../src/env.js';
import { createS3ObjectStorage } from '../src/infrastructure/object-storage/s3-object-storage.js';

const contentType = 'text/plain';
const key = 'dev/s3-smoke-test.txt';
const contents = 'Resonate MinIO smoke test';

const objectStorage = createS3ObjectStorage({
  bucket: env.AWS_S3_BUCKET,
  endpoint: env.AWS_S3_ENDPOINT,
  region: env.AWS_REGION,
});

const uploadTarget = await objectStorage.createUploadTarget(key, contentType);
const uploadResponse = await fetch(uploadTarget.url, {
  method: uploadTarget.method,
  headers: { 'content-type': contentType },
  body: contents,
});

if (!uploadResponse.ok) {
  throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
}

const metadata = await objectStorage.getMetadata(key);

console.log({
  bucket: env.AWS_S3_BUCKET,
  endpoint: env.AWS_S3_ENDPOINT ?? 'AWS',
  key,
  metadata,
});
