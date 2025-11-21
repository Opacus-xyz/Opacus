/**
 * Opacus WebSocket Transport
 * Production-ready with auto-reconnect
 */

import WebSocket from 'isomorphic-ws';
import { BaseTransport } from './base';
import { OpacusFrame } from '../types';
import { CBORCodec } from '../proto/cbor';

export class WebSocketTransport extends BaseTransport {
  private ws?: WebSocket;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private pingInterval?: NodeJS.Timeout;
  
  constructor(private url: string) {
    super();
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';
        
        const timeout = setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
            this.ws?.close();
          }
        }, 10000);
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startPing();
          resolve();
        };
        
        this.ws.onmessage = (event: any) => {
          try {
            const data = new Uint8Array(event.data);
            const frame = CBORCodec.decode(data);
            this.emit(frame);
          } catch (err) {
            console.error('Frame decode error:', err);
          }
        };
        
        this.ws.onerror = (err: any) => {
          clearTimeout(timeout);
          if (!this.connected) reject(err);
        };
        
        this.ws.onclose = () => {
          this.connected = false;
          this.stopPing();
          if (this.shouldReconnect) {
            this.attemptReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  
  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }
  
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
  
  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnects})`);
    
    await new Promise(r => setTimeout(r, delay));
    
    try {
      await this.connect();
      console.log('Reconnected successfully');
    } catch (err) {
      console.error('Reconnect failed:', err);
    }
  }
  
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopPing();
    this.ws?.close();
    this.connected = false;
  }
  
  async send(frame: OpacusFrame): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }
    
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    
    const data = CBORCodec.encode(frame);
    this.ws.send(data);
  }
}
