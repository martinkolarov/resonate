import crypto from 'node:crypto';
import { promisify } from '@/lib/promisify.js';

const promisifiedArgon2 = promisify(crypto.argon2);

export async function hashPassword(password: string, salt: Buffer) {
  return promisifiedArgon2('argon2id', {
    message: password,
    nonce: salt,
    parallelism: 1,
    memory: 65536,
    passes: 3,
    tagLength: 32,
  });
}

export async function verifyPassword(password: string, storedHash: string) {
  const [storedPassword, storedSalt] = storedHash.split(':');
  if (!storedPassword || !storedSalt) {
    return false;
  }
  const givenPasswordHash = await hashPassword(password, Buffer.from(storedSalt, 'base64'));
  const expectedPasswordHash = Buffer.from(storedPassword, 'base64');

  return (
    givenPasswordHash.length === expectedPasswordHash.length &&
    crypto.timingSafeEqual(givenPasswordHash, expectedPasswordHash)
  );
}
