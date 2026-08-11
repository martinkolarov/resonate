import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import z from 'zod';

dotenvExpand.expand(dotenv.config({ path: new URL('../.env', import.meta.url) }));

const envSchema = z.object({
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RESEND_API_KEY: z.string(),
  SENTRY_DSN: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string(),
  AWS_S3_BUCKET: z.string(),
});

export default envSchema.parse(process.env);
