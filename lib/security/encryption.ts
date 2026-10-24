import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Security utilities for encrypting/decrypting sensitive data (OAuth tokens, etc)
 * Uses AES-256-CBC encryption
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_IV_LENGTH = 16; // AES block size

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set. Please set a 32-byte hex string.');
}

// Validate key is correct length (32 bytes = 64 hex characters)
if (ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${ENCRYPTION_KEY.length} characters.`
  );
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encrypts sensitive data using AES-256-CBC
 * @param data - Plain text to encrypt
 * @returns Encrypted string (IV + encrypted data, both base64 encoded)
 */
export function encrypt(data: string): string {
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', KEY_BUFFER, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Prepend IV to encrypted data for later decryption
  const result = iv.toString('hex') + ':' + encrypted;
  return result;
}

/**
 * Decrypts encrypted data using AES-256-CBC
 * @param encryptedData - Encrypted string (IV + encrypted data)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];

  const decipher = createDecipheriv('aes-256-cbc', KEY_BUFFER, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generates a secure encryption key for use in environment variables
 * @returns 64-character hex string (32 bytes for AES-256)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
