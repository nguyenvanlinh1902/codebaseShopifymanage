import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment or generate from secret
 * In production, this should be a stable environment variable
 *
 * @returns {Buffer}
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET || 'chatty-default-secret-change-in-production';
  return crypto.scryptSync(secret, 'salt', KEY_LENGTH);
}

/**
 * Encrypt a string value
 *
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted value as base64
 */
export function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (all as hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted value
 *
 * @param {string} encryptedText - Encrypted value
 * @returns {string|null} Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Generate a secure random token
 *
 * @param {number} [length=32] - Token length in bytes
 * @returns {string} Hex-encoded token
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure random password reset token
 *
 * @returns {string}
 */
export function generateResetToken() {
  return generateToken(32);
}

/**
 * Hash a value (one-way, for tokens that need to be stored securely)
 *
 * @param {string} value - Value to hash
 * @returns {string} SHA-256 hash
 */
export function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
