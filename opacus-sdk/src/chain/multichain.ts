/**
 * Opacus Multi-Chain Adapter
 * Support for multiple blockchain networks
 */

import { ethers } from 'ethers';
import { AgentIdentity } from '../types';

export interface ChainAdapter {
  chainId: number;
  name: string;
  connect(rpc: string, privateKey?: string): Promise<void>;
  registerAgent(identity: AgentIdentity, metadata: string): Promise<string>;
  getAgent(agentId: string): Promise<any>;
  sendProof(proof: Uint8Array): Promise<string>;
  getBalance(address: string): Promise<bigint>;
}

/**
 * EVM-compatible chain adapter (Ethereum, Polygon, BSC, etc.)
 */
export class EVMChainAdapter implements ChainAdapter {
  chainId: number;
  name: string;
  private provider?: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private agentRegistry?: ethers.Contract;
  
  constructor(chainId: number, name: string) {
    this.chainId = chainId;
    this.name = name;
  }
  
  async connect(rpc: string, privateKey?: string): Promise<void> {
    this.provider = new ethers.JsonRpcProvider(rpc);
    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }
  }
  
  setAgentRegistry(address: string, abi: any[]) {
    const signerOrProvider = this.signer || this.provider;
    if (!signerOrProvider) throw new Error('Not connected');
    this.agentRegistry = new ethers.Contract(address, abi, signerOrProvider);
  }
  
  async registerAgent(identity: AgentIdentity, metadata: string): Promise<string> {
    if (!this.agentRegistry || !this.signer) throw new Error('Not initialized');
    const agentId = ethers.keccak256(ethers.toUtf8Bytes(identity.id));
    const tx = await this.agentRegistry.registerAgent(agentId, identity.edPub, identity.xPub, metadata);
    return (await tx.wait()).hash;
  }
  
  async getAgent(agentId: string): Promise<any> {
    if (!this.agentRegistry) throw new Error('Not initialized');
    return this.agentRegistry.getAgent(ethers.keccak256(ethers.toUtf8Bytes(agentId)));
  }
  
  async sendProof(proof: Uint8Array): Promise<string> {
    if (!this.signer) throw new Error('No signer');
    const tx = await this.signer.sendTransaction({ 
      data: ethers.hexlify(proof),
      to: ethers.ZeroAddress
    });
    return (await tx.wait())!.hash;
  }
  
  async getBalance(address: string): Promise<bigint> {
    if (!this.provider) throw new Error('Not connected');
    return this.provider.getBalance(address);
  }
}

/**
 * Multi-Chain Manager
 * Manages multiple blockchain connections
 */
export class MultiChainManager {
  private adapters: Map<number, ChainAdapter> = new Map();
  private primaryChainId = 16602; // 0G Testnet default
  
  registerAdapter(adapter: ChainAdapter) {
    this.adapters.set(adapter.chainId, adapter);
  }
  
  setPrimaryChain(chainId: number) {
    if (!this.adapters.has(chainId)) {
      throw new Error(`Chain ${chainId} not registered`);
    }
    this.primaryChainId = chainId;
  }
  
  getAdapter(chainId?: number): ChainAdapter {
    const id = chainId || this.primaryChainId;
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Chain ${id} not registered`);
    }
    return adapter;
  }
  
  async registerAgentAllChains(
    identity: AgentIdentity, 
    metadata: string
  ): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    
    for (const [chainId, adapter] of this.adapters) {
      try {
        const txHash = await adapter.registerAgent(identity, metadata);
        results.set(chainId, txHash);
      } catch (err: any) {
        results.set(chainId, `ERROR: ${err.message}`);
      }
    }
    
    return results;
  }
  
  getSupportedChains(): number[] {
    return Array.from(this.adapters.keys());
  }
  
  getPrimaryChain(): ChainAdapter {
    return this.getAdapter();
  }
}
