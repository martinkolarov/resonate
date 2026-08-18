import { runCommand } from '@/lib/run-command.js';

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

export type ProbeMediaResult = {
  codecName: string | undefined;
  channels: number;
  sampleFormat: string | undefined;
  sampleRate: number;
  durationSeconds: number;
};

export async function probeMedia(filePath: string): Promise<ProbeMediaResult> {
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

  const container = result.format;
  const audioStream = result?.streams?.find(stream => stream.codec_type === 'audio');

  if (!audioStream) {
    throw new Error('Missing audio stream');
  }

  const durationSeconds = Number(audioStream.duration ?? container?.duration);
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
}
