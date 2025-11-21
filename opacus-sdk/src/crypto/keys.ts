/**
 * Opacus Key Manager
 * Handles Ed25519 signing keys and X25519 encryption keys
 */

import * as ed from '@noble/ed25519';
import { x25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { AgentIdentity } from '../types';

export class KeyManager {
  /**
   * Generate Ed25519 key pair for signatures
   */
  static async generateEd25519(): Promise<{pub: Uint8Array, priv: Uint8Array}> {
    const priv = ed.utils.randomPrivateKey();
    const pub = await ed.getPublicKeyAsync(priv);
    return { priv, pub };
  }

  /**
   * Generate X25519 key pair for ECDH
   */
  static generateX25519(): {pub: Uint8Array, priv: Uint8Array} {
    const priv = randomBytes(32);
    const pub = x25519.getPublicKey(priv);
    return { priv, pub };
  }

  /**
   * Generate full agent identity with both key pairs
   */
  static async generateFullIdentity(chainId = 16602): Promise<AgentIdentity> {
    const edKeys = await this.generateEd25519();
    const xKeys = this.generateX25519();
    const id = this.toHex(sha256(edKeys.pub).slice(0, 20));
    const address = '0x' + this.toHex(sha256(edKeys.pub).slice(0, 20));
    
    return {
      id,
      edPub: edKeys.pub,
      edPriv: edKeys.priv,
      xPub: xKeys.pub,
      xPriv: xKeys.priv,
      address,
      chainId
    };
  }

  /**
   * Convert bytes to hex string
   */
  static toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert hex string to bytes
   */
  static fromHex(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Export identity to JSON
   */
  static exportIdentity(identity: AgentIdentity): string {
    return JSON.stringify({
      id: identity.id,
      edPub: this.toHex(identity.edPub),
      edPriv: this.toHex(identity.edPriv),
      xPub: this.toHex(identity.xPub),
      xPriv: this.toHex(identity.xPriv),
      address: identity.address,
      chainId: identity.chainId
    });
  }

  /**
   * Import identity from JSON
   */
  static importIdentity(json: string): AgentIdentity {
    const data = JSON.parse(json);
    return {
      id: data.id,
      edPub: this.fromHex(data.edPub),
      edPriv: this.fromHex(data.edPriv),
      xPub: this.fromHex(data.xPub),
      xPriv: this.fromHex(data.xPriv),
      address: data.address,
      chainId: data.chainId
    };
  }
}
