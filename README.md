# Opacus Protocol

**Multi-Chain Decentralized Agent Communication Protocol**

Opacus enables secure, authenticated communication between decentralized agents with native support for 0G Chain and multi-chain operations.

[![Website](https://img.shields.io/badge/Website-newopacus.vercel.app-blue)](https://newopacus.vercel.app)
[![Documentation](https://img.shields.io/badge/Docs-Read%20Now-green)](https://newopacus.vercel.app/docs)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript SDK](https://img.shields.io/badge/npm-@opacus%2Fsdk-red)](https://www.npmjs.com/package/@opacus/sdk)
[![Rust SDK](https://img.shields.io/badge/crates.io-opacus--sdk-orange)](https://crates.io/crates/opacus-sdk)

## 🚀 Features

- ✅ **End-to-End Encryption**: Ed25519 + X25519 cryptography
- ✅ **Multi-Chain Support**: Native 0G Chain integration, EVM-compatible
- ✅ **High Performance**: QUIC transport for Rust, WebSocket for TypeScript
- ✅ **Type-Safe**: Full TypeScript and Rust support
- ✅ **Production Ready**: Battle-tested SDKs with comprehensive tests
- ✅ **Easy Integration**: Simple APIs for quick setup

## 📦 SDK Packages

### TypeScript/JavaScript SDK

**Installation:**
```bash
npm install @opacus/sdk
```

**Quick Start:**
```typescript
import { OpacusClient } from '@opacus/sdk';

const client = new OpacusClient({
  privateKey: 'your-private-key',
  network: 'testnet'
});

await client.connect();
```

**Features:**
- WebSocket + WebTransport support
- Node.js 18+ & Browser compatible
- Full TypeScript definitions
- ~100KB minified

[📖 TypeScript SDK Documentation](opacus-sdk/README.md)

### Rust SDK

**Installation:**
```toml
[dependencies]
opacus-sdk = "1.0"
tokio = { version = "1.36", features = ["full"] }
```

**Quick Start:**
```rust
use opacus_sdk::{OpacusClient, ClientConfig};

let client = OpacusClient::new(config).await?;
```

**Features:**
- Native QUIC transport (HTTP/3)
- Zero-copy operations
- Async/await with Tokio
- Production-optimized

[📖 Rust SDK Documentation](opacus-rust/README.md)

## 🏗️ Project Structure

```
opacus/
├── opacus-sdk/          # TypeScript SDK (@opacus/sdk)
├── opacus-rust/         # Rust SDK (opacus-sdk)
├── sdk-ts/              # Legacy TypeScript implementation
├── sdk-rust/            # Legacy Rust implementation
├── gateway/             # WebSocket/HTTP Gateway
├── contracts/           # Smart Contracts (0G Chain, EVM)
├── website/             # Documentation website
├── EXAMPLES.md          # Quick start examples
├── PUBLISH.md           # Publishing guide
└── LICENSE              # MIT License
```

## 📚 Documentation

- **[Getting Started](https://newopacus.vercel.app/docs)** - Complete guide
- **[Examples](EXAMPLES.md)** - Code examples for both SDKs
- **[Publishing Guide](PUBLISH.md)** - How to publish packages
- **[Architecture](https://newopacus.vercel.app/docs/architecture.html)** - System design
- **[API Reference](https://newopacus.vercel.app/docs)** - Full API docs

## 🔐 Security Features

### Authentication Flow

1. **Nonce Generation**: 32-byte random nonces (30s validity)
2. **Key Exchange**: ECDH shared secret derivation
3. **Session Keys**: HKDF-based key derivation
4. **Encryption**: AES-GCM for messages
5. **Signatures**: Ed25519 digital signatures
6. **Proof Storage**: Multi-chain commitment

### Cryptography Stack

- **Signing**: Ed25519 (32-byte keys)
- **Encryption**: X25519 + AES-GCM
- **Hashing**: SHA-256
- **Key Derivation**: HKDF
- **Anti-Replay**: Nonce-based protection

## 🚦 Quick Examples

See [EXAMPLES.md](EXAMPLES.md) for complete examples.

### Send Encrypted Message (TypeScript)

```typescript
const response = await client.sendMessage({
  to: 'agent-id',
  payload: { message: 'Hello!' },
  encrypted: true
});
```

### Listen for Messages (Rust)

```rust
let mut stream = client.message_stream();
while let Some(msg) = stream.recv().await {
    println!("From: {}", msg.from);
}
```

## 🧪 Development

### Build TypeScript SDK

```bash
cd opacus-sdk
npm install
npm run build
npm test
```

### Build Rust SDK

```bash
cd opacus-rust
cargo build --release
cargo test
```

### Run Gateway

```bash
cd gateway
npm install
npm start
```

## 📦 Publishing

Both SDKs are ready for publication:

**TypeScript SDK** → npm
```bash
cd opacus-sdk
npm publish --access public
```

**Rust SDK** → crates.io
```bash
cd opacus-rust
cargo publish
```

See [PUBLISH.md](PUBLISH.md) for detailed instructions.

## 🤖 CI/CD

GitHub Actions workflows included:

- **CI**: Automated testing on push
- **Publishing**: Automated release to npm/crates.io
- **Deployment**: Vercel integration for website

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create your feature branch
3. Add tests for new features
4. Submit a pull request

## 🔗 Links

- **Website**: https://newopacus.vercel.app
- **Documentation**: https://newopacus.vercel.app/docs
- **GitHub**: https://github.com/Opacus-xyz/Opacus
- **npm Package**: https://www.npmjs.com/package/@opacus/sdk
- **crates.io**: https://crates.io/crates/opacus-sdk

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/Opacus-xyz/Opacus/issues)
- **Email**: support@opacus.network

## 🛠️ Kalıcı Çalıştırma (Gateway)

VS Code kapalı olsa bile Gateway'i çalışır tutmak için iki yöntem:

### 1. PM2 ile

```bash
cd gateway
npm install --production
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup launchd   # macOS otomatik başlatma
```

Durum & loglar:
```bash
pm2 status
pm2 logs opacus-gateway
```

Güncelleme (kod değiştirdikten sonra):
```bash
pm2 restart opacus-gateway
```

### 2. Docker + Compose

`docker-compose.yml` ile Redis + Gateway birlikte:
```bash
docker compose up -d --build
```

Log inceleme:
```bash
docker logs -f opacus-gateway
```

Yeniden başlatma / güncelleme:
```bash
docker compose pull
docker compose up -d --build gateway
```

### Temizleme
```bash
pm2 stop opacus-gateway && pm2 delete opacus-gateway
docker compose down
```

### Notlar
- `.env` içindeki test private key'lerini production'da kullanmayın.
- Redis persistence kapalı (appendonly=no); gerekirse AOF veya snapshot etkinleştirin.
- Health endpoint: `http://localhost:8080/health`
- WebSocket endpoint: `ws://localhost:8080`

---

Built with ❤️ by the Opacus Team

## 🛠️ Kalıcı Çalıştırma (Gateway)

VS Code kapalı olsa bile Gateway'i çalışır tutmak için iki yöntem:

### 1. PM2 ile

```bash
cd gateway
npm install --production
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup launchd   # macOS otomatik başlatma
```

Durum & loglar:
```bash
pm2 status
pm2 logs opacus-gateway
```

Güncelleme (kod değiştirdikten sonra):
```bash
pm2 restart opacus-gateway
```

### 2. Docker + Compose

`docker-compose.yml` ile Redis + Gateway birlikte:
```bash
docker compose up -d --build
```

Log inceleme:
```bash
docker logs -f opacus-gateway
```

Yeniden başlatma / güncelleme:
```bash
docker compose pull
docker compose up -d --build gateway
```

### Temizleme
```bash
pm2 stop opacus-gateway && pm2 delete opacus-gateway
docker compose down
```

### Notlar
- `.env` içindeki test private key'lerini production'da kullanmayın.
- Redis persistence kapalı (appendonly=no); gerekirse AOF veya snapshot etkinleştirin.
- Health endpoint: `http://localhost:8080/health`
- WebSocket endpoint: `ws://localhost:8080`
