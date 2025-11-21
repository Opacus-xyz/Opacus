# Opacus SDK - Complete Implementation

Multi-language SDK suite for decentralized agent communication.

## 📦 Implementations

### TypeScript SDK (`opacus-sdk/`)
- **Transport**: WebSocket + WebTransport (HTTP/3)
- **Runtime**: Node.js 18+ & Browser
- **Package**: `@opacus/sdk`
- **Size**: ~100KB minified

**Install:**
```bash
cd opacus-sdk
npm install
npm run build
```

### Rust SDK (`opacus-rust/`)
- **Transport**: QUIC (Quinn)
- **Runtime**: Native binary
- **Crate**: `opacus-sdk`
- **Binary Size**: ~8MB (release)

**Build:**
```
cd opacus-rust
cargo build --release
```

### Components

- **Client SDK** (TypeScript/Rust) - Easy integration for developers
- **H3-DAC Gateway** (Node.js) - Central authentication hub
- **Signature Authority** - ECDSA-based verification
- **Nonce Service** - Redis-backed temporary nonce storage
- **Shared Secret Derivation** - ECDH key exchange
- **On-Chain Contracts** - Multi-chain proof storage
- **Verifier Engine** (Rust) - High-performance verification

## 🚀 Quick Start

### Installation

```bash
# Install TypeScript SDK
npm install @h3-dac/sdk-ts

# Or use Rust SDK
cargo add h3-dac-sdk
```

### TypeScript Usage

```typescript
import { H3DAC } from '@h3-dac/sdk-ts';

const client = new H3DAC(privateKey);
const session = await client.authenticate(clientId);
await client.sendPayload({ data: "secure message" });
```

### Rust Usage

```rust
use h3_dac_sdk::Client;

let client = Client::new(private_key);
let session = client.authenticate(client_id).await?;
client.send_payload(payload).await?;
```

## 📦 Workspace Structure

```
/sdk-ts          - TypeScript SDK
/sdk-rust        - Rust SDK
/gateway         - Node.js Gateway Server
/contracts       - Smart Contracts (OG Chain, EVM, Solana)
/examples        - Demo Applications
/tests           - Integration Tests
/docs            - Documentation
```

## 🔐 Security Model

### Authentication Flow

1. Client requests nonce from gateway
2. Client signs: `hash(nonce + clientId + timestamp)`
3. ECDH shared secret derivation
4. Session key generation via HKDF
5. AES-GCM encrypted communication
6. On-chain proof commitment

### Key Features

- ✅ 32-byte random nonces (30s validity, single-use)
- ✅ ECDH key exchange for shared secrets
- ✅ HKDF for session key derivation
- ✅ Secp256k1 signatures
- ✅ AES-GCM encryption
- ✅ Multi-chain proof storage

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:integration    # Integration tests
npm run test:security       # Security test suite
```

## 🐳 Docker Support

```bash
docker-compose up           # Start entire stack
docker-compose up gateway   # Gateway only
```

## 📖 Documentation

- [Architecture Guide](./docs/architecture.md)
- [API Reference](./docs/api-reference.md)
- [SDK Documentation](./docs/sdk-guide.md)
- [Security Model](./docs/security.md)
- [Multi-Chain Support](./docs/multi-chain.md)

## 🛠️ Development

```bash
npm install                 # Install dependencies
npm run build              # Build all packages
npm run dev:gateway        # Start gateway in dev mode
npm run dev:example        # Run example client
```

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md).

## 🔗 Links

- [Website](https://h3-dac.io)
- [Documentation](https://docs.h3-dac.io)
- [GitHub](https://github.com/h3-dac)
