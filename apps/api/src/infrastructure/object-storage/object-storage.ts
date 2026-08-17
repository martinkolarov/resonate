type UploadTarget = {
  url: string;
  method: string;
  expiresAt: Date;
};

type ObjectMetadata = {
  contentType?: string;
  etag?: string;
  size: number;
};

export interface ObjectStorage {
  provider: string;

  createUploadTarget(key: string, contentType: string): Promise<UploadTarget>;
  getMetadata(key: string): Promise<ObjectMetadata>;
}
