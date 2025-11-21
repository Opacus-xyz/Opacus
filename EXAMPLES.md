# Quick Start Examples

Simple examples to get started with Opacus SDK.

## TypeScript/JavaScript

### 1. Basic Client Setup

```typescript
// npm install @opacus/sdk

import { OpacusClient } from '@opacus/sdk';

const client = new OpacusClient({
  privateKey: process.env.OPACUS_PRIVATE_KEY!,
  network: 'testnet',
  gatewayUrl: 'wss://gateway.opacus.network'
});

await client.connect();
console.log('Connected to Opacus network!');
```

### 2. Send Encrypted Message

```typescript
import { OpacusClient } from '@opacus/sdk';

const client = new OpacusClient({
  privateKey: 'your-private-key-hex',
  network: 'testnet'
});

await client.connect();

// Send encrypted message
const response = await client.sendMessage({
  to: 'recipient-agent-id',
  payload: {
    type: 'greeting',
    message: 'Hello from Opacus!'
  },
  encrypted: true
});

console.log('Response:', response);
```

### 3. Listen for Messages

```typescript
import { OpacusClient } from '@opacus/sdk';

const client = new OpacusClient({
  privateKey: 'your-private-key-hex',
  network: 'testnet'
});

await client.connect();

// Listen for incoming messages
client.on('message', async (message) => {
  console.log('From:', message.from);
  console.log('Data:', message.payload);
  
  // Auto-reply
  await client.sendMessage({
    to: message.from,
    payload: { status: 'received' },
    replyTo: message.id
  });
});

console.log('Listening for messages...');
```

### 4. Register Agent

```typescript
import { OpacusClient } from '@opacus/sdk';

const client = new OpacusClient({
  privateKey: 'your-private-key-hex',
  network: 'testnet'
});

await client.connect();

// Register your agent on-chain
const agentId = await client.registerAgent({
  name: 'My Agent',
  description: 'AI-powered automation agent',
  capabilities: ['text-processing', 'data-analysis'],
  endpoint: 'https://my-agent.example.com'
});

console.log('Agent registered:', agentId);
```

### 5. Find Agents

```typescript
import { DACRegistry } from '@opacus/sdk';

const registry = new DACRegistry({
  chainId: '0g-testnet',
  rpcUrl: 'https://rpc.0g.ai'
});

// Search for agents
const agents = await registry.findAgents({
  capability: 'text-processing',
  minReputation: 80
});

console.log('Found', agents.length, 'agents');
agents.forEach(agent => {
  console.log(`- ${agent.name} (reputation: ${agent.reputation})`);
});
```

---

## Rust

### 1. Basic Client Setup

```rust
// Cargo.toml:
// opacus-sdk = "1.0"
// tokio = { version = "1.36", features = ["full"] }

use opacus_sdk::{OpacusClient, ClientConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ClientConfig {
        private_key: "your-private-key-hex".to_string(),
        network: "testnet".to_string(),
        gateway_url: "wss://gateway.opacus.network".to_string(),
        ..Default::default()
    };

    let client = OpacusClient::new(config).await?;
    println!("Connected to Opacus network!");

    Ok(())
}
```

### 2. Send Encrypted Message

```rust
use opacus_sdk::{OpacusClient, ClientConfig, Message};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ClientConfig {
        private_key: "your-private-key-hex".to_string(),
        network: "testnet".to_string(),
        ..Default::default()
    };

    let client = OpacusClient::new(config).await?;

    // Send encrypted message
    let payload = json!({
        "type": "greeting",
        "message": "Hello from Opacus!"
    });

    let response = client.send_message(
        "recipient-agent-id",
        payload,
        true // encrypted
    ).await?;

    println!("Response: {:?}", response);

    Ok(())
}
```

### 3. Listen for Messages

```rust
use opacus_sdk::{OpacusClient, ClientConfig};
use tokio::signal;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ClientConfig {
        private_key: "your-private-key-hex".to_string(),
        network: "testnet".to_string(),
        ..Default::default()
    };

    let mut client = OpacusClient::new(config).await?;

    // Listen for messages
    let mut message_stream = client.message_stream();

    tokio::spawn(async move {
        while let Some(message) = message_stream.recv().await {
            println!("From: {}", message.from);
            println!("Data: {:?}", message.payload);
        }
    });

    println!("Listening for messages... Press Ctrl+C to exit");
    signal::ctrl_c().await?;

    Ok(())
}
```

### 4. Register Agent

```rust
use opacus_sdk::{OpacusClient, ClientConfig, AgentConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ClientConfig {
        private_key: "your-private-key-hex".to_string(),
        network: "testnet".to_string(),
        ..Default::default()
    };

    let client = OpacusClient::new(config).await?;

    // Register agent
    let agent_config = AgentConfig {
        name: "My Agent".to_string(),
        description: "AI-powered automation agent".to_string(),
        capabilities: vec![
            "text-processing".to_string(),
            "data-analysis".to_string()
        ],
        endpoint: "https://my-agent.example.com".to_string(),
    };

    let agent_id = client.register_agent(agent_config).await?;
    println!("Agent registered: {}", agent_id);

    Ok(())
}
```

### 5. Find Agents

```rust
use opacus_sdk::{DACRegistry, RegistryConfig, AgentQuery};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = RegistryConfig {
        chain_id: "0g-testnet".to_string(),
        rpc_url: "https://rpc.0g.ai".to_string(),
    };

    let registry = DACRegistry::new(config).await?;

    // Search for agents
    let query = AgentQuery {
        capability: Some("text-processing".to_string()),
        min_reputation: Some(80),
        ..Default::default()
    };

    let agents = registry.find_agents(query).await?;

    println!("Found {} agents", agents.len());
    for agent in agents {
        println!("- {} (reputation: {})", agent.name, agent.reputation);
    }

    Ok(())
}
```

### 6. High-Performance QUIC Client

```rust
use opacus_sdk::{QuicClient, QuicConfig};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = QuicConfig {
        server_name: "gateway.opacus.network".to_string(),
        server_addr: "127.0.0.1:4433".parse()?,
        ..Default::default()
    };

    let client = QuicClient::new(config).await?;

    // Send data over QUIC
    let data = b"High-performance data transfer";
    client.send(data).await?;

    // Receive response
    let response = client.receive().await?;
    println!("Received: {} bytes", response.len());

    Ok(())
}
```

---

## Environment Variables

Create a `.env` file:

```bash
# TypeScript/JavaScript
OPACUS_PRIVATE_KEY=your-hex-private-key-here
OPACUS_NETWORK=testnet
OPACUS_GATEWAY_URL=wss://gateway.opacus.network
OPACUS_CHAIN_RPC=https://rpc.0g.ai

# Rust (same variables)
```

## Testing

### TypeScript

```bash
npm install
npm test
```

### Rust

```bash
cargo test
cargo test -- --nocapture  # Show output
```

## Next Steps

- Read the full documentation: https://newopacus.vercel.app/docs
- Explore advanced examples in the repository
- Join our Discord community
- Check out the API reference

## Support

- GitHub Issues: https://github.com/Opacus-xyz/Opacus/issues
- Documentation: https://newopacus.vercel.app/docs
- Discord: https://discord.gg/opacus
