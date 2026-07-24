import crypto from 'node:crypto';

const SESSION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_TOKEN_BYTES = 16;

export function generateToken(bytes: number) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return generateToken(SESSION_TOKEN_BYTES);
}

export function generateEmailVerificationToken(): string {
  return generateToken(EMAIL_VERIFICATION_TOKEN_BYTES);
}
