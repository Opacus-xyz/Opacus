/**
 * Opacus DAC Manager
 * Manages Decentralized Agent Communication channels and data streams
 */

import { DACConfig, DataChannel, OpacusFrame, AgentIdentity } from '../types';
import { OGChainClient } from '../chain/0g';
import { SecurityManager } from '../crypto/security';

export class DACManager {
  private dacs: Map<string, DACConfig> = new Map();
  private channels: Map<string, DataChannel> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channelId -> subscriber ids
  
  constructor(
    private chainClient: OGChainClient,
    private security: SecurityManager
  ) {}
  
  /**
   * Create new DAC
   */
  async createDAC(config: DACConfig): Promise<string> {
    // Register on-chain
    const txHash = await this.chainClient.registerDAC(config);
    
    // Store locally
    this.dacs.set(config.id, config);
    
    // Initialize channels
    for (const channel of config.dataChannels) {
      this.channels.set(channel.id, channel);
      this.subscriptions.set(channel.id, new Set());
      
      // Register channel on-chain
      await this.chainClient.openDataChannel(config.id, channel);
    }
    
    return txHash;
  }
  
  /**
   * Get DAC configuration
   */
  getDAC(dacId: string): DACConfig | undefined {
    return this.dacs.get(dacId);
  }
  
  /**
   * Get all DACs
   */
  getAllDACs(): DACConfig[] {
    return Array.from(this.dacs.values());
  }
  
  /**
   * Subscribe to data channel
   */
  async subscribe(channelId: string, subscriberId: string): Promise<boolean> {
    const subs = this.subscriptions.get(channelId);
    if (!subs) return false;
    subs.add(subscriberId);
    return true;
  }
  
  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channelId: string, subscriberId: string): Promise<boolean> {
    const subs = this.subscriptions.get(channelId);
    if (!subs) return false;
    return subs.delete(subscriberId);
  }
  
  /**
   * Get channel subscribers
   */
  getSubscribers(channelId: string): string[] {
    return Array.from(this.subscriptions.get(channelId) || []);
  }
  
  /**
   * Check if subscriber is subscribed to channel
   */
  isSubscribed(channelId: string, subscriberId: string): boolean {
    const subs = this.subscriptions.get(channelId);
    return subs ? subs.has(subscriberId) : false;
  }
  
  /**
   * Broadcast to channel subscribers
   */
  async broadcastToChannel(
    channelId: string,
    identity: AgentIdentity,
    payload: any,
    sendFn: (frame: OpacusFrame, to: string) => Promise<void>
  ): Promise<number> {
    const subscribers = this.getSubscribers(channelId);
    let sent = 0;
    
    for (const subId of subscribers) {
      try {
        const frame: OpacusFrame = {
          version: 1,
          type: 'stream',
          from: identity.id,
          to: subId,
          seq: Date.now(),
          ts: Date.now(),
          nonce: this.security.generateNonce(),
          payload: { channelId, data: payload }
        };
        await sendFn(frame, subId);
        sent++;
      } catch (err) {
        // Continue broadcasting to other subscribers
      }
    }
    
    return sent;
  }
  
  /**
   * Calculate usage cost for a channel
   */
  calculateCost(channelId: string, bytes: number, messages: number): bigint {
    const channel = this.channels.get(channelId);
    if (!channel) return 0n;
    return channel.pricing.perByte * BigInt(bytes) + 
           channel.pricing.perMessage * BigInt(messages);
  }
  
  /**
   * Get channel info
   */
  getChannel(channelId: string): DataChannel | undefined {
    return this.channels.get(channelId);
  }
  
  /**
   * Get all channels
   */
  getAllChannels(): DataChannel[] {
    return Array.from(this.channels.values());
  }
}
