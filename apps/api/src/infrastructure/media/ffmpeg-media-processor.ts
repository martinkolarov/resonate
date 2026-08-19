import type { MediaInfo, MediaProcessor } from './media-processor.js';
import { runCommand } from '@/lib/run-command.js';

const OUTPUT_SAMPLE_RATE_HZ = 16_000;
const OUTPUT_BITRATE = '64k';

type FFProbeOutput = {
  format?: {
    [key: string]: unknown;
    duration?: string;
  };
  streams?: {
    [key: string]: unknown;
    codec_name?: string;
    codec_type?: string;
    channels?: number;
    duration?: string;
    sample_fmt?: string;
    sample_rate?: string;
  }[];
};

export function createFfmpegMediaProcessor(): MediaProcessor {
  return {
    async inspect(filePath): Promise<MediaInfo> {
      const { stdout } = await runCommand('ffprobe', [
        '-v',
        'error',
        '-of',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      const result = JSON.parse(stdout) as FFProbeOutput;
      const audioStream = result.streams?.find(stream => stream.codec_type === 'audio');

      if (!audioStream) {
        throw new Error('Missing audio stream');
      }

      const durationSeconds = Number(audioStream.duration ?? result.format?.duration);
      const sampleRate = Number(audioStream.sample_rate);
      const channels = Number(audioStream.channels);

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error('Invalid media duration');
      }
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error('Invalid audio sample rate');
      }
      if (!Number.isInteger(channels) || channels <= 0) {
        throw new Error('Invalid audio channel count');
      }

      return {
        codecName: audioStream.codec_name,
        channels,
        sampleFormat: audioStream.sample_fmt,
        sampleRate,
        durationSeconds,
      };
    },

    async transcodeToMp3(inputPath, outputPath): Promise<void> {
      await runCommand('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-n',
        '-i',
        inputPath,
        '-map',
        '0:a:0',
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(OUTPUT_SAMPLE_RATE_HZ),
        '-c:a',
        'libmp3lame',
        '-b:a',
        OUTPUT_BITRATE,
        '-map_metadata',
        '-1',
        '-f',
        'mp3',
        outputPath,
      ]);
    },
  };
}
