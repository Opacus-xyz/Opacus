/**
 * Opacus SDK v1.0.0 - Full Production Ready
 * 0G Chain First, Multi-Chain Ready
 * 
 * Core types and interfaces for the Opacus protocol
 */

export interface OpacusConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  relayUrl: string;
  chainRpc: string;
  privateKey?: string;
  storageIndexer?: string;
}

export interface OpacusFrame {
  version: number;
  type: 'connect' | 'msg' | 'ping' | 'ack' | 'stream' | 'payment';
  from: string;
  to: string;
  seq: number;
  ts: number;
  nonce: string;
  payload: Uint8Array | object;
  hmac?: string;
  sig?: Uint8Array;
}

export interface DACConfig {
  id: string;
  owner: string;
  metadata: DACMetadata;
  permissions: DACPermission[];
  dataChannels: DataChannel[];
  revenueModel: RevenueModel;
}

export interface DACMetadata {
  name: string;
  description: string;
  version: string;
  tags: string[];
  storageHash?: string;
}

export interface DACPermission {
  role: 'owner' | 'operator' | 'reader' | 'writer';
  address: string;
  expiry?: number;
}

export interface DataChannel {
  id: string;
  type: 'input' | 'output' | 'bidirectional';
  schema: object;
  pricing: ChannelPricing;
}

export interface ChannelPricing {
  perByte: bigint;
  perMessage: bigint;
  subscription?: bigint;
}

export interface RevenueModel {
  type: 'pay-per-use' | 'subscription' | 'stake-based';
  fee: bigint;
  treasury: string;
}

export interface AgentIdentity {
  id: string;
  edPub: Uint8Array;
  edPriv: Uint8Array;
  xPub: Uint8Array;
  xPriv: Uint8Array;
  address: string;
  chainId: number;
}

export interface NonceState {
  current: bigint;
  timestamp: number;
  window: Map<string, number>;
}

export interface ChainInfo {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  contracts: {
    dacRegistry?: string;
    agentRegistry?: string;
    dataStream?: string;
    escrow?: string;
  };
}
