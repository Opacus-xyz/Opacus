/**
 * Opacus Main Client
 * Complete SDK implementation for agent communication
 */

import { OpacusConfig, OpacusFrame, AgentIdentity, DACConfig } from './types';
import { KeyManager } from './crypto/keys';
import { SecurityManager } from './crypto/security';
import { CBORCodec } from './proto/cbor';
import { WebSocketTransport } from './transport/websocket';
import { WebTransportTransport } from './transport/webtransport';
import { ITransport } from './transport/base';
import { OGChainClient } from './chain/0g';
import { DACManager } from './dac/manager';

export class OpacusClient {
  private identity?: AgentIdentity;
  private transport?: ITransport;
  private security: SecurityManager;
  private chainClient: OGChainClient;
  private dacManager?: DACManager;
  private relayXPub?: Uint8Array;
  private messageHandlers: Map<string, (frame: OpacusFrame) => void> = new Map();
  private seq = 0;
  
  constructor(private config: OpacusConfig) {
    this.security = new SecurityManager();
    this.chainClient = new OGChainClient(config);
  }
  
  /**
   * Initialize client with new or existing identity
   */
  async init(existingIdentity?: string): Promise<AgentIdentity> {
    if (existingIdentity) {
      // Import existing identity
      this.identity = KeyManager.importIdentity(existingIdentity);
    } else {
      // Generate new identity
      const chainId = this.config.network === 'mainnet' ? 16661 : 16602;
      this.identity = await KeyManager.generateFullIdentity(chainId);
    }
    
    // Initialize DAC manager
    this.dacManager = new DACManager(this.chainClient, this.security);
    
    return this.identity;
  }
  
  /**
   * Initialize contracts
   */
  async initContracts(addresses: {
    dacRegistry: string;
    agentRegistry: string;
    dataStream: string;
    escrow: string;
  }): Promise<void> {
    await this.chainClient.initContracts(addresses);
  }
  
  /**
   * Connect to relay server
   */
  async connect(): Promise<void> {
    if (!this.identity) throw new Error('Not initialized. Call init() first');
    
    // Choose transport based on protocol and capabilities
    const isWebTransport = typeof (globalThis as any).WebTransport !== 'undefined' 
      && this.config.relayUrl.startsWith('https://');
    
    if (isWebTransport) {
      this.transport = new WebTransportTransport(this.config.relayUrl);
    } else {
      const wsUrl = this.config.relayUrl
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      this.transport = new WebSocketTransport(wsUrl);
    }
    
    // Set message handler
    this.transport.onMessage((frame) => this.handleFrame(frame));
    
    // Connect
    await this.transport.connect();
    
    // Send connect frame
    const connectFrame: OpacusFrame = {
      version: 1,
      type: 'connect',
      from: this.identity.id,
      to: 'relay',
      seq: ++this.seq,
      ts: Date.now(),
      nonce: this.security.generateNonce(),
      payload: {
        edPub: KeyManager.toHex(this.identity.edPub),
        xPub: KeyManager.toHex(this.identity.xPub)
      }
    };
    
    await this.transport.send(connectFrame);
  }
  
  /**
   * Handle incoming frames
   */
  private handleFrame(frame: OpacusFrame) {
    // Handle ACK and store relay public key
    if (frame.type === 'ack' && frame.from !== this.identity?.id) {
      const payload = frame.payload as any;
      if (payload.relayXPub) {
        this.relayXPub = KeyManager.fromHex(payload.relayXPub);
      }
    }
    
    // Call registered handlers
    const handler = this.messageHandlers.get(frame.type);
    if (handler) handler(frame);
    
    // Call catch-all handler
    const allHandler = this.messageHandlers.get('*');
    if (allHandler) allHandler(frame);
  }
  
  /**
   * Register message handler
   */
  onMessage(type: string | '*', handler: (frame: OpacusFrame) => void) {
    this.messageHandlers.set(type, handler);
  }
  
  /**
   * Send message to specific agent
   */
  async sendMessage(to: string, payload: any, peerXPub?: Uint8Array): Promise<void> {
    if (!this.identity || !this.transport) throw new Error('Not connected');
    
    const targetXPub = peerXPub || this.relayXPub;
    if (!targetXPub) throw new Error('No peer public key available');
    
    const frame = await this.security.createAuthFrame(
      this.identity,
      targetXPub,
      'msg',
      to,
      payload
    );
    frame.seq = ++this.seq;
    
    await this.transport.send(frame);
  }
  
  /**
   * Send stream data to channel
   */
  async sendStream(channelId: string, data: any): Promise<void> {
    if (!this.identity || !this.transport || !this.relayXPub) {
      throw new Error('Not connected');
    }
    
    const frame = await this.security.createAuthFrame(
      this.identity,
      this.relayXPub,
      'stream',
      'broadcast',
      { channelId, data }
    );
    frame.seq = ++this.seq;
    
    await this.transport.send(frame);
  }
  
  /**
   * Create new DAC
   */
  async createDAC(config: DACConfig): Promise<string> {
    if (!this.dacManager) throw new Error('Not initialized');
    return this.dacManager.createDAC(config);
  }
  
  /**
   * Subscribe to data channel
   */
  async subscribeToChannel(channelId: string): Promise<boolean> {
    if (!this.dacManager || !this.identity) throw new Error('Not initialized');
    return this.dacManager.subscribe(channelId, this.identity.id);
  }
  
  /**
   * Unsubscribe from data channel
   */
  async unsubscribeFromChannel(channelId: string): Promise<boolean> {
    if (!this.dacManager || !this.identity) throw new Error('Not initialized');
    return this.dacManager.unsubscribe(channelId, this.identity.id);
  }
  
  /**
   * Register agent on-chain
   */
  async registerOnChain(metadata: object): Promise<string> {
    if (!this.identity) throw new Error('Not initialized');
    return this.chainClient.registerAgent(this.identity, JSON.stringify(metadata));
  }
  
  /**
   * Get identity
   */
  getIdentity(): AgentIdentity | undefined {
    return this.identity;
  }
  
  /**
   * Export identity (be careful with private keys!)
   */
  exportIdentity(): string {
    if (!this.identity) throw new Error('Not initialized');
    return KeyManager.exportIdentity(this.identity);
  }
  
  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.transport?.isConnected() || false;
  }
  
  /**
   * Get balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.identity) throw new Error('Not initialized');
    return this.chainClient.getBalance(this.identity.address);
  }
  
  /**
   * Get network info
   */
  getNetworkInfo() {
    return this.chainClient.getNetworkInfo();
  }
  
  /**
   * Disconnect from relay
   */
  async disconnect(): Promise<void> {
    await this.transport?.disconnect();
  }
}
