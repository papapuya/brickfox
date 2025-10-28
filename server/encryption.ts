import crypto from 'crypto';

// Verschlüsselungsschlüssel (sollte aus einer sicheren Quelle kommen)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!';
const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedData = textParts.join(':');
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Hilfsfunktion zum Verschlüsseln von API-Schlüsseln
export function encryptApiKey(apiKey: string): string {
  return encrypt(apiKey);
}

// Hilfsfunktion zum Entschlüsseln von API-Schlüsseln
export function decryptApiKey(encryptedApiKey: string): string {
  return decrypt(encryptedApiKey);
}
