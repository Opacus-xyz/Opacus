/**
 * Opacus WebTransport Implementation
 * For HTTP/3 and QUIC support
 */

import { BaseTransport } from './base';
import { OpacusFrame } from '../types';
import { CBORCodec } from '../proto/cbor';

export class WebTransportTransport extends BaseTransport {
  private transport?: any;
  private writer?: any;
  private reader?: any;
  
  constructor(private url: string) {
    super();
  }
  
  async connect(): Promise<void> {
    if (typeof (globalThis as any).WebTransport === 'undefined') {
      throw new Error('WebTransport not supported in this environment');
    }
    
    this.transport = new (globalThis as any).WebTransport(this.url);
    await this.transport.ready;
    
    this.writer = this.transport.datagrams.writable.getWriter();
    this.reader = this.transport.datagrams.readable.getReader();
    this.connected = true;
    
    // Start reading in background
    this.readLoop();
  }
  
  private async readLoop() {
    try {
      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        try {
          const frame = CBORCodec.decode(value);
          this.emit(frame);
        } catch (err) {
          console.error('Frame decode error:', err);
        }
      }
    } catch (err) {
      console.error('Read loop error:', err);
      this.connected = false;
    }
  }
  
  async disconnect(): Promise<void> {
    this.connected = false;
    
    try {
      await this.writer?.close();
    } catch {}
    
    try {
      await this.transport?.close();
    } catch {}
  }
  
  async send(frame: OpacusFrame): Promise<void> {
    if (!this.writer) {
      throw new Error('Not connected');
    }
    
    const data = CBORCodec.encode(frame);
    await this.writer.write(data);
  }
}
