import { describe, test, expect, beforeEach } from 'vitest';
import { KeyManager } from '../src/crypto/keys';
import { SecurityManager } from '../src/crypto/security';
import type { AgentIdentity } from '../src/types';

describe('KeyManager', () => {
  test('generateEd25519 produces valid key pair', async () => {
    const keys = await KeyManager.generateEd25519();
    expect(keys.pub).toBeInstanceOf(Uint8Array);
    expect(keys.priv).toBeInstanceOf(Uint8Array);
    expect(keys.pub.length).toBe(32);
    expect(keys.priv.length).toBe(32);
  });

  test('generateX25519 produces valid key pair', () => {
    const keys = KeyManager.generateX25519();
    expect(keys.pub).toBeInstanceOf(Uint8Array);
    expect(keys.priv).toBeInstanceOf(Uint8Array);
    expect(keys.pub.length).toBe(32);
    expect(keys.priv.length).toBe(32);
  });

  test('generateFullIdentity creates complete identity', async () => {
    const identity = await KeyManager.generateFullIdentity(16602);
    expect(identity.id).toBeTruthy();
    expect(identity.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(identity.edPub.length).toBe(32);
    expect(identity.edPriv.length).toBe(32);
    expect(identity.xPub.length).toBe(32);
    expect(identity.xPriv.length).toBe(32);
    expect(identity.chainId).toBe(16602);
  });

  test('hex conversion roundtrip', () => {
    const original = new Uint8Array([0, 15, 255, 128]);
    const hex = KeyManager.toHex(original);
    const decoded = KeyManager.fromHex(hex);
    expect(decoded).toEqual(original);
  });

  test('hex handles 0x prefix', () => {
    const bytes = KeyManager.fromHex('0x0102');
    expect(bytes).toEqual(new Uint8Array([1, 2]));
  });

  test('export and import identity roundtrip', async () => {
    const original = await KeyManager.generateFullIdentity();
    const exported = KeyManager.exportIdentity(original);
    const imported = KeyManager.importIdentity(exported);
    
    expect(imported.id).toBe(original.id);
    expect(imported.address).toBe(original.address);
    expect(imported.chainId).toBe(original.chainId);
    expect(imported.edPub).toEqual(original.edPub);
    expect(imported.edPriv).toEqual(original.edPriv);
    expect(imported.xPub).toEqual(original.xPub);
    expect(imported.xPriv).toEqual(original.xPriv);
  });
});

describe('SecurityManager', () => {
  let security: SecurityManager;
  let alice: AgentIdentity;
  let bob: AgentIdentity;

  beforeEach(async () => {
    security = new SecurityManager();
    alice = await KeyManager.generateFullIdentity();
    bob = await KeyManager.generateFullIdentity();
  });

  test('ECDH shared secret matches for both parties', () => {
    const aliceShared = security.deriveSharedSecret(alice.xPriv, bob.xPub);
    const bobShared = security.deriveSharedSecret(bob.xPriv, alice.xPub);
    expect(aliceShared).toEqual(bobShared);
  });

  test('session key derivation is deterministic', () => {
    const shared = security.deriveSharedSecret(alice.xPriv, bob.xPub);
    const key1 = security.deriveSessionKey(shared);
    const key2 = security.deriveSessionKey(shared);
    expect(key1).toEqual(key2);
    expect(key1.length).toBe(32);
  });

  test('HMAC generation and verification', () => {
    const key = new Uint8Array(32).fill(42);
    const data = 'test message';
    const hmac = security.generateHMAC(key, data);
    expect(typeof hmac).toBe('string');
    expect(hmac.length).toBe(64); // 32 bytes hex
    expect(security.verifyHMAC(key, data, hmac)).toBe(true);
    expect(security.verifyHMAC(key, 'wrong', hmac)).toBe(false);
  });

  test('nonce format is valid', () => {
    const nonce = security.generateNonce();
    expect(nonce).toMatch(/^\d+-[0-9a-f]{16}$/);
  });

  test('nonce validation prevents replay', () => {
    const nonce = security.generateNonce();
    expect(security.validateNonce(nonce)).toBe(true);
    expect(security.validateNonce(nonce)).toBe(false); // replay
  });

  test('nonce validation rejects old timestamps', () => {
    const oldNonce = '1000000000-0000000000000000';
    expect(security.validateNonce(oldNonce)).toBe(false);
  });

  test('sign and verify message', async () => {
    const message = new Uint8Array([1, 2, 3, 4]);
    const sig = await security.signMessage(alice.edPriv, message);
    expect(sig).toBeInstanceOf(Uint8Array);
    expect(sig.length).toBe(64);
    
    const valid = await security.verifySignature(alice.edPub, message, sig);
    expect(valid).toBe(true);
    
    const tampered = new Uint8Array([1, 2, 3, 5]);
    const invalidVerify = await security.verifySignature(alice.edPub, tampered, sig);
    expect(invalidVerify).toBe(false);
  });

  test('createAuthFrame produces complete frame', async () => {
    const frame = await security.createAuthFrame(alice, bob.xPub, 'msg', bob.id, { text: 'hello' });
    expect(frame.version).toBe(1);
    expect(frame.type).toBe('msg');
    expect(frame.from).toBe(alice.id);
    expect(frame.to).toBe(bob.id);
    expect(frame.seq).toBeGreaterThan(0);
    expect(frame.ts).toBeGreaterThan(0);
    expect(frame.nonce).toBeTruthy();
    expect(frame.hmac).toBeTruthy();
    expect(frame.sig).toBeInstanceOf(Uint8Array);
    expect(frame.sig!.length).toBe(64);
  });

  test('verifyAuthFrame validates authentic frame', async () => {
    const frame = await security.createAuthFrame(alice, bob.xPub, 'msg', bob.id, { text: 'hello' });
    const bobSecurity = new SecurityManager();
    const result = await bobSecurity.verifyAuthFrame(frame, alice.edPub, bob.xPriv, alice.xPub);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('verifyAuthFrame rejects tampered payload', async () => {
    const frame = await security.createAuthFrame(alice, bob.xPub, 'msg', bob.id, { text: 'hello' });
    frame.payload = { text: 'tampered' };
    const bobSecurity = new SecurityManager();
    const result = await bobSecurity.verifyAuthFrame(frame, alice.edPub, bob.xPriv, alice.xPub);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('HMAC');
  });

  test('verifyAuthFrame rejects replayed nonce', async () => {
    const frame = await security.createAuthFrame(alice, bob.xPub, 'msg', bob.id, { text: 'hello' });
    const bobSecurity = new SecurityManager();
    await bobSecurity.verifyAuthFrame(frame, alice.edPub, bob.xPriv, alice.xPub);
    const result2 = await bobSecurity.verifyAuthFrame(frame, alice.edPub, bob.xPriv, alice.xPub);
    expect(result2.valid).toBe(false);
    expect(result2.reason).toContain('nonce');
  });

  test('session key storage and retrieval', () => {
    const key = new Uint8Array(32).fill(7);
    security.storeSessionKey('peer-123', key);
    const retrieved = security.getSessionKey('peer-123');
    expect(retrieved).toEqual(key);
    expect(security.getSessionKey('unknown')).toBeUndefined();
  });

  test('clearSessionKeys removes all keys', () => {
    security.storeSessionKey('peer-1', new Uint8Array(32));
    security.storeSessionKey('peer-2', new Uint8Array(32));
    security.clearSessionKeys();
    expect(security.getSessionKey('peer-1')).toBeUndefined();
    expect(security.getSessionKey('peer-2')).toBeUndefined();
  });
});
