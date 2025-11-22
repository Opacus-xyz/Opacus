import { describe, test, expect } from 'vitest';
import { CBORCodec } from '../src/proto/cbor';
import type { OpacusFrame } from '../src/types';

describe('CBORCodec', () => {
  test('encode produces Uint8Array', () => {
    const frame: OpacusFrame = {
      version: 1,
      type: 'msg',
      from: 'alice',
      to: 'bob',
      seq: 1,
      ts: Date.now(),
      nonce: '123-abc',
      payload: { text: 'hello' }
    };
    const encoded = CBORCodec.encode(frame);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.length).toBeGreaterThan(0);
  });

  test('decode restores original frame', () => {
    const original: OpacusFrame = {
      version: 1,
      type: 'ping',
      from: 'sender-123',
      to: 'receiver-456',
      seq: 42,
      ts: 1700000000000,
      nonce: '1700000000000-aabbccdd',
      payload: { ping: true }
    };
    const encoded = CBORCodec.encode(original);
    const decoded = CBORCodec.decode(encoded);
    
    expect(decoded.version).toBe(original.version);
    expect(decoded.type).toBe(original.type);
    expect(decoded.from).toBe(original.from);
    expect(decoded.to).toBe(original.to);
    expect(decoded.seq).toBe(original.seq);
    expect(decoded.ts).toBe(original.ts);
    expect(decoded.nonce).toBe(original.nonce);
    expect(decoded.payload).toEqual(original.payload);
  });

  test('encode handles optional fields', () => {
    const frame: OpacusFrame = {
      version: 1,
      type: 'ack',
      from: 'relay',
      to: 'client',
      seq: 1,
      ts: Date.now(),
      nonce: '123',
      payload: {},
      hmac: 'abcd1234',
      sig: new Uint8Array(64)
    };
    const encoded = CBORCodec.encode(frame);
    const decoded = CBORCodec.decode(encoded);
    expect(decoded.hmac).toBe(frame.hmac);
    expect(decoded.sig).toEqual(frame.sig);
  });

  test('encode payload only', () => {
    const payload = { msg: 'test', num: 123, arr: [1, 2, 3] };
    const encoded = CBORCodec.encodePayload(payload);
    expect(encoded).toBeInstanceOf(Uint8Array);
    const decoded = CBORCodec.decodePayload(encoded);
    expect(decoded).toEqual(payload);
  });

  test('estimateSize returns positive number', () => {
    const frame: OpacusFrame = {
      version: 1,
      type: 'stream',
      from: 'producer',
      to: 'broadcast',
      seq: 10,
      ts: Date.now(),
      nonce: 'nonce',
      payload: { data: new Uint8Array(100) }
    };
    const size = CBORCodec.estimateSize(frame);
    expect(size).toBeGreaterThan(0);
  });

  test('CBOR is more compact than JSON for frames', () => {
    const frame: OpacusFrame = {
      version: 1,
      type: 'msg',
      from: 'a'.repeat(40),
      to: 'b'.repeat(40),
      seq: 999,
      ts: Date.now(),
      nonce: '1234567890-abcdef',
      payload: { text: 'x'.repeat(200) }
    };
    const cborSize = CBORCodec.encode(frame).length;
    const jsonSize = new TextEncoder().encode(JSON.stringify(frame)).length;
    expect(cborSize).toBeLessThan(jsonSize);
  });

  test('handles binary payload', () => {
    const binary = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const frame: OpacusFrame = {
      version: 1,
      type: 'stream',
      from: 'src',
      to: 'dst',
      seq: 1,
      ts: Date.now(),
      nonce: 'n',
      payload: binary
    };
    const encoded = CBORCodec.encode(frame);
    const decoded = CBORCodec.decode(encoded);
    expect(decoded.payload).toEqual(binary);
  });
});
