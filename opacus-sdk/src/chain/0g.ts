/**
 * Opacus 0G Chain Integration
 * Smart contract interaction for DAC and Agent registry
 */

import { ethers } from 'ethers';
import { OpacusConfig, DACConfig, AgentIdentity, DataChannel, ChainInfo } from '../types';

// 0G Network Constants
export const OG_NETWORKS: Record<string, ChainInfo> = {
  mainnet: {
    chainId: 16661,
    name: '0G Mainnet',
    rpc: 'https://evmrpc.0g.ai',
    explorer: 'https://chainscan.0g.ai',
    contracts: {}
  },
  testnet: {
    chainId: 16602,
    name: '0G Galileo Testnet',
    rpc: 'https://evmrpc-testnet.0g.ai',
    explorer: 'https://chainscan-galileo.0g.ai',
    contracts: {}
  }
};

// Contract ABIs
const DAC_REGISTRY_ABI = [
  'function registerDAC(bytes32 dacId, string metadata, address owner) external returns (bool)',
  'function getDAC(bytes32 dacId) external view returns (tuple(address owner, string metadata, uint256 created, bool active))',
  'function updateDAC(bytes32 dacId, string metadata) external returns (bool)',
  'function transferDAC(bytes32 dacId, address newOwner) external returns (bool)',
  'function deactivateDAC(bytes32 dacId) external returns (bool)',
  'event DACRegistered(bytes32 indexed dacId, address indexed owner, uint256 timestamp)',
  'event DACUpdated(bytes32 indexed dacId, string metadata, uint256 timestamp)'
];

const AGENT_REGISTRY_ABI = [
  'function registerAgent(bytes32 agentId, bytes edPub, bytes xPub, string metadata) external returns (bool)',
  'function getAgent(bytes32 agentId) external view returns (tuple(bytes edPub, bytes xPub, address owner, uint256 registered, bool active))',
  'function rotateKeys(bytes32 agentId, bytes newEdPub, bytes newXPub) external returns (bool)',
  'function deactivateAgent(bytes32 agentId) external returns (bool)',
  'event AgentRegistered(bytes32 indexed agentId, address indexed owner, uint256 timestamp)',
  'event KeysRotated(bytes32 indexed agentId, uint256 timestamp)'
];

const DATA_STREAM_ABI = [
  'function openChannel(bytes32 dacId, bytes32 channelId, uint256 pricePerByte, uint256 pricePerMsg) external returns (bool)',
  'function closeChannel(bytes32 channelId) external returns (bool)',
  'function subscribe(bytes32 channelId) external payable returns (bool)',
  'function unsubscribe(bytes32 channelId) external returns (bool)',
  'function recordUsage(bytes32 channelId, address user, uint256 bytes, uint256 msgs) external returns (bool)',
  'function settle(bytes32 channelId) external returns (uint256)',
  'event ChannelOpened(bytes32 indexed dacId, bytes32 indexed channelId, uint256 timestamp)',
  'event UsageRecorded(bytes32 indexed channelId, address indexed user, uint256 bytes, uint256 msgs)'
];

const ESCROW_ABI = [
  'function lock(bytes32 lockId, address payee, uint256 amount) external returns (bool)',
  'function release(bytes32 lockId) external returns (bool)',
  'function cancel(bytes32 lockId) external returns (bool)',
  'function getLock(bytes32 lockId) external view returns (tuple(address payer, address payee, uint256 amount, bool released, uint256 created))',
  'event Locked(bytes32 indexed lockId, address payer, address payee, uint256 amount)',
  'event Released(bytes32 indexed lockId, uint256 timestamp)'
];

export class OGChainClient {
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private network: ChainInfo;
  
  // Contract instances
  private dacRegistry?: ethers.Contract;
  private agentRegistry?: ethers.Contract;
  private dataStream?: ethers.Contract;
  private escrow?: ethers.Contract;
  
  constructor(config: OpacusConfig) {
    this.network = config.network === 'mainnet' ? OG_NETWORKS.mainnet : OG_NETWORKS.testnet;
    this.provider = new ethers.JsonRpcProvider(config.chainRpc || this.network.rpc);
    
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
  }
  
  /**
   * Initialize contract instances
   */
  async initContracts(addresses: {
    dacRegistry: string;
    agentRegistry: string;
    dataStream: string;
    escrow: string;
  }) {
    const signerOrProvider = this.signer || this.provider;
    this.dacRegistry = new ethers.Contract(addresses.dacRegistry, DAC_REGISTRY_ABI, signerOrProvider);
    this.agentRegistry = new ethers.Contract(addresses.agentRegistry, AGENT_REGISTRY_ABI, signerOrProvider);
    this.dataStream = new ethers.Contract(addresses.dataStream, DATA_STREAM_ABI, signerOrProvider);
    this.escrow = new ethers.Contract(addresses.escrow, ESCROW_ABI, signerOrProvider);
  }
  
  /**
   * Register agent on-chain
   */
  async registerAgent(identity: AgentIdentity, metadata: string): Promise<string> {
    if (!this.agentRegistry || !this.signer) throw new Error('Not initialized');
    
    const agentId = ethers.keccak256(ethers.toUtf8Bytes(identity.id));
    const tx = await this.agentRegistry.registerAgent(
      agentId,
      identity.edPub,
      identity.xPub,
      metadata
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  /**
   * Get agent from chain
   */
  async getAgent(agentId: string): Promise<any> {
    if (!this.agentRegistry) throw new Error('Not initialized');
    const id = ethers.keccak256(ethers.toUtf8Bytes(agentId));
    return this.agentRegistry.getAgent(id);
  }
  
  /**
   * Register DAC on-chain
   */
  async registerDAC(config: DACConfig): Promise<string> {
    if (!this.dacRegistry || !this.signer) throw new Error('Not initialized');
    
    const dacId = ethers.keccak256(ethers.toUtf8Bytes(config.id));
    const metadata = JSON.stringify(config.metadata);
    const tx = await this.dacRegistry.registerDAC(dacId, metadata, config.owner);
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  /**
   * Get DAC from chain
   */
  async getDAC(dacId: string): Promise<any> {
    if (!this.dacRegistry) throw new Error('Not initialized');
    const id = ethers.keccak256(ethers.toUtf8Bytes(dacId));
    return this.dacRegistry.getDAC(id);
  }
  
  /**
   * Open data channel on-chain
   */
  async openDataChannel(dacId: string, channel: DataChannel): Promise<string> {
    if (!this.dataStream || !this.signer) throw new Error('Not initialized');
    
    const dacIdHash = ethers.keccak256(ethers.toUtf8Bytes(dacId));
    const channelId = ethers.keccak256(ethers.toUtf8Bytes(channel.id));
    const tx = await this.dataStream.openChannel(
      dacIdHash,
      channelId,
      channel.pricing.perByte,
      channel.pricing.perMessage
    );
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  /**
   * Lock funds in escrow
   */
  async lockEscrow(lockId: string, payee: string, amount: bigint): Promise<string> {
    if (!this.escrow || !this.signer) throw new Error('Not initialized');
    
    const id = ethers.keccak256(ethers.toUtf8Bytes(lockId));
    const tx = await this.escrow.lock(id, payee, amount);
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  /**
   * Release escrow funds
   */
  async releaseEscrow(lockId: string): Promise<string> {
    if (!this.escrow || !this.signer) throw new Error('Not initialized');
    
    const id = ethers.keccak256(ethers.toUtf8Bytes(lockId));
    const tx = await this.escrow.release(id);
    const receipt = await tx.wait();
    return receipt.hash;
  }
  
  /**
   * Get account balance
   */
  async getBalance(address?: string): Promise<bigint> {
    const addr = address || this.signer?.address;
    if (!addr) throw new Error('No address provided');
    return this.provider.getBalance(addr);
  }
  
  /**
   * Get chain ID
   */
  async getChainId(): Promise<number> {
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }
  
  /**
   * Get network info
   */
  getNetworkInfo(): ChainInfo {
    return this.network;
  }
}
