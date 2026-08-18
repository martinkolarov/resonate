import { spawn } from 'node:child_process';

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

async function runCommand(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.once('error', reject);

    child.once('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function probeMedia(filePath: string) {
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

  const duration = Number(audioStream.duration ?? container?.duration);
  const sampleRate = Number(audioStream.sample_rate);
  const channels = Number(audioStream.channels);

  if (!Number.isFinite(duration) || duration <= 0) {
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
    duration,
  };
}
