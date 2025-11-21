/**
 * Opacus Transport Base Interface
 */

import { OpacusFrame } from '../types';

export interface ITransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: OpacusFrame): Promise<void>;
  onMessage(handler: (frame: OpacusFrame) => void): void;
  isConnected(): boolean;
}

export abstract class BaseTransport implements ITransport {
  protected messageHandler?: (frame: OpacusFrame) => void;
  protected connected = false;
  
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(frame: OpacusFrame): Promise<void>;
  
  onMessage(handler: (frame: OpacusFrame) => void): void {
    this.messageHandler = handler;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  protected emit(frame: OpacusFrame) {
    if (this.messageHandler) this.messageHandler(frame);
  }
}
