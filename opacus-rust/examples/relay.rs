//! Relay server example
//! 
//! Run with: cargo run --example relay

use opacus_sdk::OpacusRelayServer;
use tracing_subscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();
    
    println!("\n🚀 Starting Opacus Relay Server");
    println!("================================\n");
    
    // Create relay server
    let mut relay = OpacusRelayServer::new(4242);
    
    // Start server
    relay.start().await?;
    
    println!("\n✅ Server started successfully!");
    println!("📡 Listening on: 0.0.0.0:4242");
    println!("🔒 Protocol: QUIC (HTTP/3)");
    println!("\nPress Ctrl+C to shutdown\n");
    
    // Statistics loop
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
    
    loop {
        interval.tick().await;
        
        let agent_count = relay.get_agent_count();
        let pending_count = relay.get_pending_count();
        
        println!("📊 Stats:");
        println!("  Connected agents: {}", agent_count);
        println!("  Pending messages: {}", pending_count);
        
        if agent_count > 0 {
            println!("  Active agents:");
            for agent_id in relay.get_connected_agents() {
                println!("    - {}", agent_id);
            }
        }
        println!();
    }
}
