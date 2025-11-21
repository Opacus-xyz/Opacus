# Opacus SDK

**Production-ready Multi-Chain Decentralized Agent Communication Protocol**

Opacus SDK enables secure, authenticated communication between decentralized agents with built-in support for 0G Chain and multi-chain operations.

## 🚀 Features

- ✅ **Ed25519 + X25519 Cryptography** - Signing and encryption keys
- ✅ **ECDH Key Exchange** - Secure shared secret derivation
- ✅ **Nonce-based Anti-Replay** - Protection against replay attacks
- ✅ **CBOR Binary Framing** - Efficient serialization
- ✅ **WebSocket & WebTransport** - Multiple transport options
- ✅ **0G Chain Integration** - Native support for 0G network
- ✅ **Multi-Chain Ready** - EVM-compatible chain support
- ✅ **DAC Management** - Data channel creation and subscriptions
- ✅ **Micropayment Escrow** - Built-in payment support

## 📦 Installation

```bash
npm install @opacus/sdk
```

## 🔧 Quick Start

### Initialize Client

```typescript
import { OpacusClient } from '@opacus/sdk';

const config = {
  network: 'testnet',
  relayUrl: 'wss://relay.opacus.io',
  chainRpc: 'https://evmrpc-testnet.0g.ai',
  privateKey: process.env.PRIVATE_KEY
};

const client = new OpacusClient(config);

// Initialize identity
const identity = await client.init();
console.log('Agent ID:', identity.id);
console.log('Address:', identity.address);

// Connect to relay
await client.connect();
```

### Send Messages

```typescript
// Listen for messages
client.onMessage('msg', (frame) => {
  console.log('From:', frame.from);
  console.log('Message:', frame.payload);
});

// Send message to another agent
await client.sendMessage('target-agent-id', {
  type: 'greeting',
  text: 'Hello from Opacus!'
});
```

### Create DAC (Data Channel)

```typescript
const dacConfig = {
  id: 'my-dac-001',
  owner: identity.address,
  metadata: {
    name: 'My Data Stream',
    description: 'Real-time data service',
    version: '1.0.0',
    tags: ['data', 'streaming']
  },
  permissions: [
    { role: 'owner', address: identity.address }
  ],
  dataChannels: [
    {
      id: 'main-stream',
      type: 'output',
      schema: { type: 'object' },
      pricing: {
        perByte: 1n,
        perMessage: 100n
      }
    }
  ],
  revenueModel: {
    type: 'pay-per-use',
    fee: 0n,
    treasury: identity.address
  }
};

const txHash = await client.createDAC(dacConfig);
console.log('DAC created:', txHash);
```

### Subscribe to Data Streams

```typescript
// Subscribe
await client.subscribeToChannel('main-stream');

// Listen for stream data
client.onMessage('stream', (frame) => {
  const { channelId, data } = frame.payload;
  console.log(`Channel ${channelId}:`, data);
});

// Send stream data
await client.sendStream('main-stream', {
  timestamp: Date.now(),
  value: Math.random() * 100
});
```

### Register On-Chain

```typescript
// Initialize contracts
await client.initContracts({
  dacRegistry: '0x...',
  agentRegistry: '0x...',
  dataStream: '0x...',
  escrow: '0x...'
});

// Register agent on-chain
const txHash = await client.registerOnChain({
  name: 'MyAgent',
  version: '1.0.0',
  capabilities: ['chat', 'data-stream']
});

console.log('Registered:', txHash);
```

## 🔐 Security Model

### Triple-Layer Authentication

1. **Ed25519 Signatures** - Message signing and verification
2. **HMAC-SHA256** - Message authentication codes
3. **Nonce Validation** - 60-second window, single-use

### Key Exchange

```typescript
// ECDH shared secret
const shared = security.deriveSharedSecret(myPrivateKey, peerPublicKey);

// Session key derivation
const sessionKey = security.deriveSessionKey(shared);

// HMAC generation
const hmac = security.generateHMAC(sessionKey, messageData);
```

## 🌐 Multi-Chain Support

```typescript
import { MultiChainManager, EVMChainAdapter } from '@opacus/sdk';

const manager = new MultiChainManager();

// Add Ethereum
const ethAdapter = new EVMChainAdapter(1, 'Ethereum Mainnet');
await ethAdapter.connect('https://eth-rpc.gateway.pokt.network', privateKey);
manager.registerAdapter(ethAdapter);

// Add Polygon
const polyAdapter = new EVMChainAdapter(137, 'Polygon Mainnet');
await polyAdapter.connect('https://polygon-rpc.com', privateKey);
manager.registerAdapter(polyAdapter);

// Register agent on all chains
const results = await manager.registerAgentAllChains(identity, metadata);
```

## 📡 Transport Options

### WebSocket (Recommended)

```typescript
import { WebSocketTransport } from '@opacus/sdk';

const transport = new WebSocketTransport('wss://relay.opacus.io');
await transport.connect();
```

### WebTransport (HTTP/3)

```typescript
import { WebTransportTransport } from '@opacus/sdk';

const transport = new WebTransportTransport('https://relay.opacus.io');
await transport.connect();
```

## 🔌 API Reference

### OpacusClient

#### `init(existingIdentity?: string): Promise<AgentIdentity>`
Initialize with new or existing identity

#### `connect(): Promise<void>`
Connect to relay server

#### `sendMessage(to: string, payload: any): Promise<void>`
Send message to specific agent

#### `sendStream(channelId: string, data: any): Promise<void>`
Send data to stream channel

#### `createDAC(config: DACConfig): Promise<string>`
Create new DAC with channels

#### `registerOnChain(metadata: object): Promise<string>`
Register agent on blockchain

#### `getBalance(): Promise<bigint>`
Get account balance

#### `disconnect(): Promise<void>`
Disconnect from relay

### KeyManager

#### `generateFullIdentity(chainId?: number): Promise<AgentIdentity>`
Generate new identity with Ed25519 and X25519 keys

#### `exportIdentity(identity: AgentIdentity): string`
Export identity to JSON string

#### `importIdentity(json: string): AgentIdentity`
Import identity from JSON

### SecurityManager

#### `generateNonce(): string`
Generate anti-replay nonce

#### `createAuthFrame(...): Promise<OpacusFrame>`
Create authenticated frame with signature + HMAC + nonce

#### `verifyAuthFrame(...): Promise<{valid: boolean, reason?: string}>`
Verify frame authentication

## 🧪 Examples

See the `/examples` directory for complete examples:

- `client-example.ts` - Basic client usage
- `relay-example.ts` - Running a relay server
- `browser-example.html` - Browser integration
- `dac-example.ts` - Creating and managing DACs
- `multichain-example.ts` - Multi-chain deployment

## 📝 Smart Contracts

Solidity contracts are available in `/contracts`:

- `DACRegistry.sol` - DAC registration and management
- `AgentRegistry.sol` - Agent registration and key rotation
- `DataStream.sol` - Data channel subscriptions and payments
- `Escrow.sol` - Micropayment escrow system

## 🔗 Network Information

### 0G Mainnet
- Chain ID: 16661
- RPC: https://evmrpc.0g.ai
- Explorer: https://chainscan.0g.ai

### 0G Testnet (Galileo)
- Chain ID: 16602
- RPC: https://evmrpc-testnet.0g.ai
- Explorer: https://chainscan-galileo.0g.ai

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- Website: https://opacus.io
- Documentation: https://docs.opacus.io
- GitHub: https://github.com/opacus/opacus-sdk
- Discord: https://discord.gg/opacus

---

**Built with ❤️ for the decentralized future**
