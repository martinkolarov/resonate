type UploadTarget = {
  url: string;
  method: string;
  expiresAt: Date;
};

export interface ObjectStorage {
  provider: string;

  createUploadTarget(key: string, contentType: string): Promise<UploadTarget>;
}
