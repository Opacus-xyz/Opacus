import { randomBytes } from 'crypto';
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { hkdf } from '@noble/hashes/hkdf';

/**
 * Generate gateway keypair (run once and store securely)
 */
export function generateGatewayKeys(): {
  privateKey: string;
  publicKey: string;
} {
  const privateKey = secp.utils.randomPrivateKey();
  const publicKey = secp.getPublicKey(privateKey);

  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
  };
}

/**
 * Generate a random nonce
 */
export function generateNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Verify signature
 */
export async function verifySignature(
  message: Uint8Array,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const hash = sha256(message);
    const sig = Buffer.from(signature, 'hex');
    const pubKey = Buffer.from(publicKey, 'hex');
    return await secp.verify(sig, hash, pubKey);
  } catch (error) {
    return false;
  }
}

/**
 * Derive shared secret using ECDH
 */
export function deriveSharedSecret(
  privateKey: string,
  publicKey: string
): Uint8Array {
  const privKey = Buffer.from(privateKey, 'hex');
  const pubKey = Buffer.from(publicKey, 'hex');
  const shared = secp.getSharedSecret(privKey, pubKey);
  // Remove the 0x04 prefix if present
  return shared.slice(shared.length === 33 ? 1 : 0);
}

/**
 * Derive session key from shared secret using HKDF
 */
export function deriveSessionKey(sharedSecret: Uint8Array): Uint8Array {
  const salt = new Uint8Array(32);
  const info = new TextEncoder().encode('H3DAC');
  const sessionKey = hkdf(sha256, sharedSecret, salt, info, 32);
  return sessionKey;
}

/**
 * Hash data with SHA256
 */
export function hashData(data: Uint8Array): string {
  return Buffer.from(sha256(data)).toString('hex');
}

/**
 * Concatenate byte arrays
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
  return Buffer.from(bytes).toString('hex');
}
