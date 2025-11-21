//! # Opacus SDK for Rust
//! 
//! High-performance QUIC-native decentralized agent communication protocol.
//! 
//! ## Features
//! 
//! - **QUIC Transport**: HTTP/3 ready with Quinn
//! - **Ed25519 + X25519**: Dual-key cryptography
//! - **CBOR Framing**: Efficient binary serialization
//! - **Multi-Chain**: 0G Chain first, EVM compatible
//! - **Type-Safe**: Full Rust type safety
//! 
//! ## Example
//! 
//! ```rust,no_run
//! use opacus_sdk::{OpacusClient, OpacusConfig, Network};
//! 
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let config = OpacusConfig {
//!         network: Network::Testnet,
//!         relay_url: "quic://relay.opacus.io:4242".to_string(),
//!         chain_rpc: "https://evmrpc-testnet.0g.ai".to_string(),
//!         private_key: None,
//!     };
//!     
//!     let mut client = OpacusClient::new(config);
//!     let identity = client.init().await;
//!     client.connect().await?;
//!     
//!     Ok(())
//! }
//! ```

pub mod types;
pub mod crypto;
pub mod proto;
pub mod transport;
pub mod client;
pub mod relay;

pub use types::*;
pub use crypto::*;
pub use proto::*;
pub use transport::*;
pub use client::*;
pub use relay::*;
