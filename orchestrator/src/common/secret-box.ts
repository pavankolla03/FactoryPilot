import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM secret box for user-supplied model API keys (BYOM, beta).
 * Key derives from MODEL_KEY_SECRET (fall back to AUTH_JWT_SECRET) so a
 * database dump alone never exposes customer keys. Format:
 * base64(iv).base64(tag).base64(ciphertext)
 */
function key(): Buffer {
  const secret = process.env.MODEL_KEY_SECRET || process.env.AUTH_JWT_SECRET || 'dev-secret';
  return createHash('sha256').update(secret).digest();
}

export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function openSecret(sealed: string): string {
  const [iv, tag, data] = sealed.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
