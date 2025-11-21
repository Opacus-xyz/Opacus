/**
 * Opacus CBOR Codec
 * Efficient binary serialization for frames
 */

import { encode, decode } from 'cbor-x';
import { OpacusFrame } from '../types';

export class CBORCodec {
  /**
   * Encode frame to CBOR binary format with integer keys
   */
  static encode(frame: OpacusFrame): Uint8Array {
    // Use compact encoding with integer keys to save space
    const compact = {
      1: frame.version,
      2: frame.type,
      3: frame.from,
      4: frame.to,
      5: frame.seq,
      6: frame.ts,
      7: frame.nonce,
      8: frame.payload,
      9: frame.hmac,
      10: frame.sig
    };
    return encode(compact);
  }

  /**
   * Decode CBOR binary to frame
   */
  static decode(data: Uint8Array): OpacusFrame {
    const compact: any = decode(data);
    return {
      version: compact[1],
      type: compact[2],
      from: compact[3],
      to: compact[4],
      seq: compact[5],
      ts: compact[6],
      nonce: compact[7],
      payload: compact[8],
      hmac: compact[9],
      sig: compact[10]
    };
  }

  /**
   * Estimate encoded size
   */
  static estimateSize(frame: OpacusFrame): number {
    return this.encode(frame).length;
  }

  /**
   * Encode payload only
   */
  static encodePayload(payload: any): Uint8Array {
    return encode(payload);
  }

  /**
   * Decode payload only
   */
  static decodePayload<T = any>(data: Uint8Array): T {
    return decode(data);
  }
}
