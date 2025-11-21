//! Client example
//! 
//! Run with: cargo run --example client

use opacus_sdk::{OpacusClient, OpacusConfig, Network};
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
    
    // Create configuration
    let config = OpacusConfig {
        network: Network::Testnet,
        relay_url: "quic://127.0.0.1:4242".to_string(),
        chain_rpc: "https://evmrpc-testnet.0g.ai".to_string(),
        private_key: None,
    };
    
    // Create client
    let mut client = OpacusClient::new(config);
    
    // Initialize with new identity
    let identity = client.init().await;
    println!("\n🔑 Agent Identity:");
    println!("  ID: {}", identity.id);
    println!("  Address: {}", identity.address);
    println!("  Chain: {}", identity.chain_id);
    
    // Export keys (for restoration later)
    if let Some((ed_priv, x_priv)) = client.export_identity() {
        println!("\n💾 Private Keys (save securely!):");
        println!("  Ed25519: {}", ed_priv);
        println!("  X25519: {}", x_priv);
    }
    
    // Connect to relay
    println!("\n📡 Connecting to relay...");
    client.connect().await?;
    println!("✅ Connected!");
    
    // Send a test message
    println!("\n📤 Sending test message...");
    let payload = serde_json::json!({
        "type": "greeting",
        "text": "Hello from Opacus Rust SDK!",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    client.send_message(
        "target-agent-id",
        serde_json::to_vec(&payload)?
    ).await?;
    
    println!("✅ Message sent!");
    
    // Receive loop
    println!("\n👂 Listening for messages...");
    println!("Press Ctrl+C to exit\n");
    
    while let Some(frame) = client.recv().await {
        match frame.frame_type {
            opacus_sdk::FrameType::Ack => {
                println!("✅ ACK received from relay");
            }
            opacus_sdk::FrameType::Msg => {
                println!("\n📬 Message received:");
                println!("  From: {}", frame.from);
                println!("  Seq: {}", frame.seq);
                if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&frame.payload) {
                    println!("  Payload: {}", serde_json::to_string_pretty(&payload)?);
                }
            }
            opacus_sdk::FrameType::Stream => {
                println!("\n📊 Stream data received:");
                println!("  From: {}", frame.from);
                if let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&frame.payload) {
                    println!("  Data: {}", payload);
                }
            }
            opacus_sdk::FrameType::Ping => {
                println!("💓 Ping from {}", frame.from);
            }
            _ => {
                println!("📦 Frame received: {:?}", frame.frame_type);
            }
        }
    }
    
    // Disconnect
    client.disconnect().await;
    println!("\n👋 Disconnected");
    
    Ok(())
}
