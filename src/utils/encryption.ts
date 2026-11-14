import 'dotenv/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ETHOL_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      '[Encryption]: ETHOL_ENCRYPTION_KEY not found in environment variables.'
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      '[Encryption]: ETHOL_ENCRYPTION_KEY must be 64 hex characters (32 bytes).'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
