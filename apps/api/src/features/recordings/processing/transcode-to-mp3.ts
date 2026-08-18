import { runCommand } from '@/lib/run-command.js';

const OUTPUT_SAMPLE_RATE_HZ = 16_000;
const OUTPUT_BITRATE = '64k';

export async function transcodeToMp3(inputPath: string, outputPath: string): Promise<void> {
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
}
