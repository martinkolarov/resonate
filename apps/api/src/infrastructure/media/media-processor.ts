export type MediaInfo = {
  codecName: string | undefined;
  channels: number;
  sampleFormat: string | undefined;
  sampleRate: number;
  durationSeconds: number;
};

export interface MediaProcessor {
  inspect(filePath: string): Promise<MediaInfo>;
  transcodeToMp3(inputPath: string, outputPath: string): Promise<void>;
}
