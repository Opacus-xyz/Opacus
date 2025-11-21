import { randomBytes } from 'crypto';
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes as nobleRandom } from '@noble/hashes/utils';

/**
 * Generate a secure random private key
 */
export function generatePrivateKey(): Uint8Array {
  return secp.utils.randomPrivateKey();
}

/**
 * Get public key from private key
 */
export function getPublicKey(privateKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privateKey);
}

/**
 * Sign a message with private key
 */
export async function signMessage(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  const hash = sha256(message);
  const signature = await secp.signAsync(hash, privateKey);
  return signature;
}

/**
 * Verify a signature
 */
export async function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const hash = sha256(message);
  return secp.verify(signature, hash, publicKey);
}

/**
 * Derive shared secret using ECDH
 */
export function deriveSharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Uint8Array {
  const shared = secp.getSharedSecret(privateKey, publicKey);
  // Remove the 0x04 prefix if present (uncompressed key marker)
  return shared.slice(shared.length === 33 ? 1 : 0);
}

/**
 * Derive session key from shared secret using HKDF
 */
export function deriveSessionKey(sharedSecret: Uint8Array): Uint8Array {
  const salt = new Uint8Array(32); // Zero salt
  const info = new TextEncoder().encode('H3DAC');
  const sessionKey = hkdf(sha256, sharedSecret, salt, info, 32);
  return sessionKey;
}

/**
 * Encrypt payload with AES-GCM
 */
export function encryptPayload(
  payload: Uint8Array,
  sessionKey: Uint8Array
): { encrypted: Uint8Array; nonce: Uint8Array } {
  const nonce = nobleRandom(12); // 96-bit nonce for GCM
  const cipher = gcm(sessionKey, nonce);
  const encrypted = cipher.encrypt(payload);
  return { encrypted, nonce };
}

/**
 * Decrypt payload with AES-GCM
 */
export function decryptPayload(
  encrypted: Uint8Array,
  sessionKey: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const cipher = gcm(sessionKey, nonce);
  return cipher.decrypt(encrypted);
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash data with SHA256
 */
export function hashData(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/**
 * Concatenate multiple byte arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
