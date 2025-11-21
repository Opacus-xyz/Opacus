/**
 * Opacus Security Manager
 * Handles ECDH, HKDF, HMAC, signatures, and nonce management
 */

import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { hmac } from '@noble/hashes/hmac';
import { hkdf } from '@noble/hashes/hkdf';
import * as ed from '@noble/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { KeyManager } from './keys';
import { AgentIdentity, OpacusFrame } from '../types';

export class SecurityManager {
  private nonceWindow: Map<string, number> = new Map();
  private lastNonce: bigint = 0n;
  private sessionKeys: Map<string, Uint8Array> = new Map();

  /**
   * Derive shared secret using ECDH
   */
  deriveSharedSecret(myPriv: Uint8Array, peerPub: Uint8Array): Uint8Array {
    return x25519.getSharedSecret(myPriv, peerPub);
  }

  /**
   * Derive session key from shared secret using HKDF
   */
  deriveSessionKey(sharedSecret: Uint8Array, info = 'opacus-session'): Uint8Array {
    return hkdf(sha256, sharedSecret, undefined, info, 32);
  }

  /**
   * Generate HMAC for message authentication
   */
  generateHMAC(key: Uint8Array, data: string): string {
    const h = hmac(sha256, key, new TextEncoder().encode(data));
    return KeyManager.toHex(h);
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(key: Uint8Array, data: string, expected: string): boolean {
    const computed = this.generateHMAC(key, data);
    return computed === expected;
  }

  /**
   * Generate nonce (anti-replay protection)
   */
  generateNonce(): string {
    const timestamp = Date.now();
    const random = randomBytes(8);
    const nonce = `${timestamp}-${KeyManager.toHex(random)}`;
    return nonce;
  }

  /**
   * Validate nonce to prevent replay attacks
   */
  validateNonce(nonce: string, maxAge = 60000): boolean {
    const [tsStr] = nonce.split('-');
    const ts = parseInt(tsStr, 10);
    const now = Date.now();
    
    // Check timestamp freshness
    if (now - ts > maxAge) return false;
    
    // Check if already used (replay attack)
    if (this.nonceWindow.has(nonce)) return false;
    
    // Store nonce
    this.nonceWindow.set(nonce, now);
    
    // Cleanup old nonces
    this.cleanupNonces(maxAge);
    
    return true;
  }

  private cleanupNonces(maxAge: number) {
    const now = Date.now();
    for (const [n, ts] of this.nonceWindow) {
      if (now - ts > maxAge * 2) this.nonceWindow.delete(n);
    }
  }

  /**
   * Sign message with Ed25519
   */
  async signMessage(priv: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    return ed.signAsync(message, priv);
  }

  /**
   * Verify Ed25519 signature
   */
  async verifySignature(pub: Uint8Array, message: Uint8Array, sig: Uint8Array): Promise<boolean> {
    return ed.verifyAsync(sig, message, pub);
  }

  /**
   * Create authenticated frame with signature + HMAC + nonce
   */
  async createAuthFrame(
    identity: AgentIdentity,
    peerXPub: Uint8Array,
    type: OpacusFrame['type'],
    to: string,
    payload: any
  ): Promise<OpacusFrame> {
    const nonce = this.generateNonce();
    const ts = Date.now();
    const seq = Number(++this.lastNonce);
    
    // Derive session key
    const shared = this.deriveSharedSecret(identity.xPriv, peerXPub);
    const sessionKey = this.deriveSessionKey(shared);
    
    // Create HMAC
    const hmacData = `${type}|${identity.id}|${to}|${seq}|${ts}|${nonce}|${JSON.stringify(payload)}`;
    const hmacVal = this.generateHMAC(sessionKey, hmacData);
    
    // Create frame
    const frame: OpacusFrame = {
      version: 1,
      type,
      from: identity.id,
      to,
      seq,
      ts,
      nonce,
      payload,
      hmac: hmacVal
    };
    
    // Sign frame
    const frameBytes = new TextEncoder().encode(JSON.stringify({
      version: frame.version,
      type: frame.type,
      from: frame.from,
      to: frame.to,
      seq: frame.seq,
      ts: frame.ts,
      nonce: frame.nonce,
      hmac: frame.hmac
    }));
    frame.sig = await this.signMessage(identity.edPriv, frameBytes);
    
    return frame;
  }

  /**
   * Verify authenticated frame (signature + HMAC + nonce)
   */
  async verifyAuthFrame(
    frame: OpacusFrame,
    senderEdPub: Uint8Array,
    myXPriv: Uint8Array,
    senderXPub: Uint8Array
  ): Promise<{valid: boolean, reason?: string}> {
    // 1. Validate nonce
    if (!this.validateNonce(frame.nonce)) {
      return { valid: false, reason: 'Invalid or replayed nonce' };
    }
    
    // 2. Verify signature
    const frameBytes = new TextEncoder().encode(JSON.stringify({
      version: frame.version,
      type: frame.type,
      from: frame.from,
      to: frame.to,
      seq: frame.seq,
      ts: frame.ts,
      nonce: frame.nonce,
      hmac: frame.hmac
    }));
    
    if (!frame.sig || !(await this.verifySignature(senderEdPub, frameBytes, frame.sig))) {
      return { valid: false, reason: 'Invalid signature' };
    }
    
    // 3. Verify HMAC
    const shared = this.deriveSharedSecret(myXPriv, senderXPub);
    const sessionKey = this.deriveSessionKey(shared);
    const hmacData = `${frame.type}|${frame.from}|${frame.to}|${frame.seq}|${frame.ts}|${frame.nonce}|${JSON.stringify(frame.payload)}`;
    
    if (!this.verifyHMAC(sessionKey, hmacData, frame.hmac!)) {
      return { valid: false, reason: 'HMAC mismatch' };
    }
    
    return { valid: true };
  }

  /**
   * Store session key for future use
   */
  storeSessionKey(peerId: string, key: Uint8Array) {
    this.sessionKeys.set(peerId, key);
  }

  /**
   * Get stored session key
   */
  getSessionKey(peerId: string): Uint8Array | undefined {
    return this.sessionKeys.get(peerId);
  }

  /**
   * Clear session keys
   */
  clearSessionKeys() {
    this.sessionKeys.clear();
  }
}
