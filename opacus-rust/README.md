# Opacus Rust SDK

**High-Performance QUIC-Native Agent Communication Protocol**

Production-ready Rust implementation of the Opacus protocol with native QUIC transport (HTTP/3) using Quinn.

## 🚀 Features

- ✅ **QUIC Transport** - Native HTTP/3 with Quinn for maximum performance
- ✅ **Ed25519 + X25519** - Dual-key cryptography (signing + encryption)
- ✅ **ECDH Key Exchange** - Secure shared secret derivation
- ✅ **CBOR Framing** - Efficient binary serialization
- ✅ **Zero-Copy** - Minimal allocations for high throughput
- ✅ **Async/Await** - Fully async with Tokio runtime
- ✅ **Type-Safe** - Rust's strong type system
- ✅ **Multi-Chain** - 0G Chain first, EVM compatible

## 📦 Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
opacus-sdk = "1.0"
tokio = { version = "1.36", features = ["full"] }
```

## 🔧 Quick Start

### Basic Client

```rust
use opacus_sdk::{OpacusClient, OpacusConfig, Network};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Configure client
    let config = OpacusConfig {
        network: Network::Testnet,
        relay_url: "quic://relay.opacus.io:4242".to_string(),
        chain_rpc: "https://evmrpc-testnet.0g.ai".to_string(),
        private_key: None,
    };
    
    // Create and initialize
    let mut client = OpacusClient::new(config);
    let identity = client.init().await;
    
    println!("Agent ID: {}", identity.id);
    println!("Address: {}", identity.address);
    
    // Connect to relay
    client.connect().await?;
    
    // Send message
    let payload = serde_json::json!({
        "type": "greeting",
        "text": "Hello from Rust!"
    });
    client.send_message("target-id", serde_json::to_vec(&payload)?).await?;
    
    // Receive messages
    while let Some(frame) = client.recv().await {
        println!("Received: {:?}", frame);
    }
    
    Ok(())
}
```

### Run Relay Server

```rust
use opacus_sdk::OpacusRelayServer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut relay = OpacusRelayServer::new(4242);
    relay.start().await?;
    
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        println!("Connected: {}", relay.get_agent_count());
    }
}
```

## 🔐 Cryptography

### Key Generation

```rust
use opacus_sdk::{KeyManager, SecurityManager};

// Generate Ed25519 (signing)
let (signing_key, verifying_key) = KeyManager::generate_ed25519();

// Generate X25519 (encryption)
let (private_key, public_key) = KeyManager::generate_x25519();

// Generate full identity
let identity = KeyManager::generate_identity(16602);
```

### ECDH Key Exchange

```rust
let shared_secret = SecurityManager::derive_shared_secret(
    &my_private_key,
    &peer_public_key
);

let session_key = SecurityManager::derive_session_key(
    &shared_secret,
    b"opacus-session"
);
```

### Authentication

```rust
let mut security = SecurityManager::new();

// Create authenticated frame
let frame = security.create_auth_frame(
    &identity,
    &peer_x_pub,
    FrameType::Msg,
    "recipient-id",
    payload
);

// Verify frame
security.verify_auth_frame(
    &frame,
    &sender_ed_pub,
    &my_x_priv,
    &sender_x_pub
)?;
```

## 📡 QUIC Transport

### Why QUIC?

- **0-RTT Connection** - Resume connections instantly
- **Multiplexing** - Multiple streams without head-of-line blocking
- **Built-in Encryption** - TLS 1.3 by default
- **UDP-based** - Better firewall traversal
- **Connection Migration** - Survives IP changes

### Performance

Benchmarks on MacBook Pro M1:

- **Latency**: ~1ms (local), ~50ms (cross-region)
- **Throughput**: 10K+ messages/sec
- **Memory**: ~2MB per client
- **CPU**: Minimal overhead

## 🌐 Network Support

### 0G Mainnet
```rust
Network::Mainnet // Chain ID: 16661
```

### 0G Testnet
```rust
Network::Testnet // Chain ID: 16602
```

### Local Development
```rust
Network::Devnet // Chain ID: 16600
```

## 📖 API Reference

### OpacusClient

```rust
impl OpacusClient {
    // Create new client
    pub fn new(config: OpacusConfig) -> Self;
    
    // Initialize with new identity
    pub async fn init(&mut self) -> &AgentIdentity;
    
    // Restore from existing keys
    pub async fn init_from_keys(&mut self, ed_priv: [u8; 32], x_priv: [u8; 32]) -> Result<&AgentIdentity>;
    
    // Connect to relay
    pub async fn connect(&mut self) -> Result<()>;
    
    // Send message
    pub async fn send_message(&mut self, to: &str, payload: Vec<u8>) -> Result<()>;
    
    // Send stream data
    pub async fn send_stream(&mut self, channel_id: &str, data: Vec<u8>) -> Result<()>;
    
    // Receive frame (blocking)
    pub async fn recv(&mut self) -> Option<OpacusFrame>;
    
    // Get identity
    pub fn get_identity(&self) -> Option<&AgentIdentity>;
    
    // Export keys
    pub fn export_identity(&self) -> Option<(String, String)>;
    
    // Check status
    pub fn is_connected(&self) -> bool;
    
    // Disconnect
    pub async fn disconnect(&mut self);
}
```

### OpacusRelayServer

```rust
impl OpacusRelayServer {
    // Create relay
    pub fn new(port: u16) -> Self;
    
    // Start server
    pub async fn start(&mut self) -> Result<()>;
    
    // Get stats
    pub fn get_agent_count(&self) -> usize;
    pub fn get_connected_agents(&self) -> Vec<String>;
    pub fn get_pending_count(&self) -> usize;
}
```

## 🧪 Examples

Run the examples:

```bash
# Start relay server
cargo run --example relay

# In another terminal, run client
cargo run --example client
```

## 🔬 Testing

```bash
# Run all tests
cargo test

# Run with logs
RUST_LOG=debug cargo test

# Run specific test
cargo test test_ecdh
```

## 🚀 Production Build

```bash
# Optimized release build
cargo build --release

# Binary size: ~8MB (with opt-level=3, lto=true)
```

## 🐛 Debugging

Enable detailed logging:

```rust
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::DEBUG)
    .init();
```

## 📊 Monitoring

```rust
// Client stats
println!("Connected: {}", client.is_connected());

// Relay stats
println!("Agents: {}", relay.get_agent_count());
println!("Pending: {}", relay.get_pending_count());
```

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- Website: https://opacus.xyz
- Documentation: https://opacus.xyz/docs
- GitHub: https://github.com/Opacus-xyz/Opacus

## 🙏 Credits

Built with:
- [Quinn](https://github.com/quinn-rs/quinn) - QUIC implementation
- [ed25519-dalek](https://github.com/dalek-cryptography/ed25519-dalek) - Ed25519 signatures
- [x25519-dalek](https://github.com/dalek-cryptography/x25519-dalek) - X25519 ECDH
- [Tokio](https://tokio.rs) - Async runtime

---

**Built with 🦀 and ❤️ for the decentralized future**
