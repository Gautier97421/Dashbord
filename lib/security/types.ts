/**
 * Type definitions for security operations
 */

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface EncryptedTokenPair {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}
