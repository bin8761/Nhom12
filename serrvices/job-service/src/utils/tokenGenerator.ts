import { generateKeyPairSync } from 'crypto';
import { loadAppConfig } from '../config/appConfig';

let fallbackKeyPair: { publicKey: string } | null = null;

function ensureFallbackPublicKey(): string {
  if (fallbackKeyPair) {
    return fallbackKeyPair.publicKey;
  }

  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const exported = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  fallbackKeyPair = { publicKey: exported };
  console.warn('[Job Service] JWT public key not configured. Using ephemeral key for development.');
  return exported;
}

export function resolvePublicKey(): string {
  const config = loadAppConfig();
  if (config.jwt.publicKey) {
    return config.jwt.publicKey;
  }
  return ensureFallbackPublicKey();
}
